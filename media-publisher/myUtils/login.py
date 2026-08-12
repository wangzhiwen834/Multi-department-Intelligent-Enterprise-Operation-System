import asyncio
import json
import sqlite3
import time
from queue import Queue, Empty
from playwright.async_api import async_playwright
from utils.base_social_media import set_init_script
from pathlib import Path
from conf import BASE_DIR, LOCAL_CHROME_PATH
from newFileUpload.platform_configs import get_platform_key_by_type, PLATFORM_CONFIGS



# 统一登录异步处理函数
def run_unified_login(type, id, status_queue, command_queue=None):
    """
    统一登录异步处理函数
    参数：
        type: 平台类型编号
        id: 账号名
        status_queue: 状态队列，用于返回登录状态
        command_queue: 命令队列，接收前端交互指令 (click/refresh/type/scroll)
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(unified_login_cookie_gen(type, id, status_queue, command_queue))
        loop.close()
    except Exception as e:
        print(f"统一登录失败: {str(e)}")
        status_queue.put(json.dumps({"code": 500, "msg": f"登录失败: {str(e)}", "data": None}))

# 统一登录cookie生成函数
async def unified_login_cookie_gen(type, id, status_queue, command_queue=None):
    """
    统一登录cookie生成函数
    参数：
        type: 平台类型编号
        id: 账号名
        status_queue: 状态队列，用于返回登录状态
        command_queue: 命令队列，接收前端交互指令
    新流程：headless打开登录页 → 截图二维码发SSE → 用户扫码/交互 → 检测登录成功
    """
    import base64, io
    try:
        # 获取平台key
        platform_key = get_platform_key_by_type(int(type))
        if not platform_key:
            status_queue.put(json.dumps({"code": 400, "msg": "不支持的平台类型", "data": None}))
            return

        # 获取平台配置
        platform_config = PLATFORM_CONFIGS.get(platform_key)
        if not platform_config:
            status_queue.put(json.dumps({"code": 400, "msg": "平台配置不存在", "data": None}))
            return

        # 生成cookie文件路径
        cookie_file = f"{platform_key}_cookie_{id}.json"
        cookie_file_path = Path(BASE_DIR / "cookiesFile" / cookie_file)

        # 创建cookiesFile目录（如果不存在）
        cookie_file_path.parent.mkdir(parents=True, exist_ok=True)

        status_queue.put(json.dumps({"code": 100, "msg": "正在启动浏览器...", "data": None}))

        # 使用Playwright进行登录
        async with async_playwright() as playwright:
            options = {
                'args': [
                    f'--lang en-US',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--ignore-certificate-errors',
                    '--disable-blink-features=AutomationControlled'
                ],
                'headless': True,  # 服务器 headless
                'executable_path': LOCAL_CHROME_PATH,
            }

            # 启动浏览器(大视口适配抖音创作者中心等宽页面)
            browser = await playwright.chromium.launch(**options)
            context = await browser.new_context(viewport={"width": 1440, "height": 900})
            context = await set_init_script(context)
            page = await context.new_page()
            await page.goto(platform_config["login_url"], wait_until='domcontentloaded', timeout=60000)

            # 获取视口尺寸，发给前端用于坐标映射
            viewport = page.viewport_size or {"width": 1280, "height": 720}
            status_queue.put(json.dumps({
                "code": 100, "msg": "视口信息",
                "data": {"viewport": {"width": viewport["width"], "height": viewport["height"]}}
            }))

            # 等待页面渲染完成，截图发给前端（让用户扫码）
            await asyncio.sleep(3)
            screenshot = await page.screenshot(type='jpeg', quality=75)
            qr_b64 = base64.b64encode(screenshot).decode()
            status_queue.put(json.dumps({
                "code": 100, "msg": "请扫码登录(可点击页面交互)",
                "data": {
                    "qr": f"data:image/jpeg;base64,{qr_b64}",
                    "viewport": {"width": viewport["width"], "height": viewport["height"]}
                }
            }))

            # 发完第一张截图后, 每2秒截一张, 直到登录成功
            # (改为2秒,让交互后的反馈更快可见)
            login_wait_timeout = 300000  # 5分钟
            initial_url = page.url
            login_successful = False
            screenshot_interval = 2  # 秒

            async def on_url_change(frame):
                nonlocal login_successful
                if frame == page.main_frame:
                    current_url = page.url
                    if "login" not in current_url.lower() and "passport" not in current_url.lower():
                        login_successful = True

            page.on('framenavigated', on_url_change)

            async def handle_command(cmd: dict):
                """执行前端发来的交互命令"""
                nonlocal screenshot_interval, viewport, last_screenshot
                try:
                    action = cmd.get("action", "")
                    if action == "click":
                        x = float(cmd.get("x", 0))
                        y = float(cmd.get("y", 0))
                        await page.mouse.click(x, y)
                        status_queue.put(json.dumps({
                            "code": 100, "msg": f"已点击 ({int(x)}, {int(y)})",
                            "data": None
                        }))
                    elif action == "refresh":
                        await page.reload(wait_until='domcontentloaded')
                        await asyncio.sleep(2)
                        status_queue.put(json.dumps({
                            "code": 100, "msg": "页面已刷新",
                            "data": None
                        }))
                    elif action == "type":
                        text = str(cmd.get("text", ""))
                        if text:
                            await page.keyboard.type(text)
                            status_queue.put(json.dumps({
                                "code": 100, "msg": f"已输入文本",
                                "data": None
                            }))
                    elif action == "press":
                        key = str(cmd.get("key", ""))
                        if key:
                            await page.keyboard.press(key)
                    elif action == "scroll_down":
                        await page.mouse.wheel(0, 300)
                    elif action == "scroll_up":
                        await page.mouse.wheel(0, -300)
                    elif action == "resize":
                        w = int(cmd.get("width", 1440))
                        h = int(cmd.get("height", 900))
                        await page.set_viewport_size({"width": w, "height": h})
                        viewport = page.viewport_size or {"width": w, "height": h}
                        status_queue.put(json.dumps({
                            "code": 100, "msg": f"窗口已调整为 {viewport['width']}×{viewport['height']}",
                            "data": {"viewport": {"width": viewport["width"], "height": viewport["height"]}}
                        }))
                    elif action == "goto":
                        url = str(cmd.get("url", ""))
                        if url:
                            await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                            status_queue.put(json.dumps({
                                "code": 100, "msg": f"已跳转: {url[:60]}",
                                "data": None
                            }))
                    # 命令执行后立即截一次图，让用户马上看到变化
                    last_screenshot = 0
                except Exception as e:
                    status_queue.put(json.dumps({
                        "code": 100, "msg": f"操作失败: {str(e)}",
                        "data": None
                    }))

            start_time = time.time()
            last_screenshot = start_time
            try:
                while time.time() - start_time < login_wait_timeout / 1000:
                    if login_successful:
                        break

                    # 处理命令队列
                    if command_queue:
                        while True:
                            try:
                                cmd = command_queue.get_nowait()
                                await handle_command(cmd)
                            except Empty:
                                break

                    # 每 screenshot_interval 秒截一次图
                    now = time.time()
                    if now - last_screenshot > screenshot_interval:
                        try:
                            screenshot = await page.screenshot(type='jpeg', quality=60)
                            qr_b64 = base64.b64encode(screenshot).decode()
                            status_queue.put(json.dumps({
                                "code": 100, "msg": "等待扫码中...",
                                "data": {
                                    "qr": f"data:image/jpeg;base64,{qr_b64}",
                                    "viewport": {"width": viewport["width"], "height": viewport["height"]}
                                }
                            }))
                            last_screenshot = now
                        except Exception:
                            pass
                    await asyncio.sleep(0.5)  # 更快轮询以响应命令
            except asyncio.TimeoutError:
                print("URL变化事件检测超时")
                login_successful = False
            except Exception as e:
                print(f"URL变化事件检测异常: {str(e)}")
                login_successful = False

            # 如果检测到登录成功，才保存cookie和插入数据库
            if login_successful:
                # 保存cookie
                await context.storage_state(path=str(cookie_file_path))
                status_queue.put(json.dumps({"code": 200, "msg": "Cookie已保存", "data": None}))
                print(f"[OK] 成功保存cookies文件: {cookie_file_path}")

                # 关闭浏览器
                await context.close()
                await browser.close()

                # 将账号信息插入数据库
                with sqlite3.connect(Path(BASE_DIR / "db" / "database.db")) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO user_info (type, userName, filePath, status)
                        VALUES (?, ?, ?, ?)
                    ''', (type, id, cookie_file, 1))
                    conn.commit()

                status_queue.put(json.dumps({"code": 200, "msg": "登录成功", "data": None}))
            else:
                # 登录超时或失败
                await context.close()
                await browser.close()
                status_queue.put(json.dumps({"code": 500, "msg": "登录超时或失败，请检查网络连接或手动登录", "data": None}))

    except Exception as e:
        print(f"统一登录失败: {str(e)}")
        status_queue.put(json.dumps({"code": 500, "msg": f"登录失败: {str(e)}", "data": None}))


# 删除账号
def delete_account(account_id):
    """
    删除账号
    :param account_id: 账号ID
    :return: 字典，包含删除结果
    """
    try:
        # 获取数据库连接
        with sqlite3.connect(Path(BASE_DIR / "db" / "database.db")) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # 查询要删除的记录
            cursor.execute("SELECT * FROM user_info WHERE id = ?", (account_id,))
            record = cursor.fetchone()

            if not record:
                return {
                    "code": 404,
                    "msg": "account not found",
                    "data": None
                }

            record = dict(record)
            file_path = record['filePath']

            # 删除数据库记录
            cursor.execute("DELETE FROM user_info WHERE id = ?", (account_id,))
            conn.commit()

        # 删除对应的cookies文件
        cookies_file = Path(BASE_DIR / "cookiesFile" / file_path)
        if cookies_file.exists():
            cookies_file.unlink()
            print(f"[OK] 成功删除cookies文件: {cookies_file}")

        return {
            "code": 200,
            "msg": "account deleted successfully",
            "data": None
        }

    except Exception as e:
        return {
            "code": 500,
            "msg": "delete failed!",
            "data": None
        }