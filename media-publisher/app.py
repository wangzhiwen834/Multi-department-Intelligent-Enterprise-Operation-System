import asyncio
import os
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from queue import Queue
from functools import wraps

from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS

from conf import (
    BASE_DIR, PORT, HOST, API_KEY,
    UPLOAD_DIR, COOKIE_DIR, DB_PATH,
    LOCAL_CHROME_PATH,
)
from myUtils.auth import check_cookie
from myUtils.login import run_unified_login, delete_account
from newFileUpload.multiFileUploader import post_file, post_multiple_files_to_multiple_platforms
from newFileUpload.platform_configs import (
    get_platform_key_by_type,
    get_type_by_platform_key,
    PLATFORM_CONFIGS,
)

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB

active_queues = {}


# ---------- API Key 鉴权中间件 ----------
def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if API_KEY:
            key = request.headers.get('X-API-Key', '')
            if key != API_KEY:
                return jsonify({'code': 401, 'msg': 'Unauthorized', 'data': None}), 401
        return f(*args, **kwargs)
    return decorated


# ---------- 数据库辅助 ----------
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """初始化数据库表"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type INTEGER NOT NULL,
                filePath TEXT NOT NULL,
                userName TEXT NOT NULL,
                status INTEGER DEFAULT 0
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS file_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                filesize REAL,
                upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                file_path TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS publish_task_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_id INTEGER,
                account_id INTEGER NOT NULL,
                account_name TEXT NOT NULL,
                platform_name TEXT NOT NULL,
                platform_type INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT '待发布',
                create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_msg TEXT
            )
        ''')
        conn.commit()


# ---------- 健康检查 ----------
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'code': 200, 'msg': 'ok', 'data': {'status': 'running'}})


# ==================== 平台配置 ====================

@app.route('/platforms', methods=['GET'])
@require_api_key
def get_platforms():
    """获取所有支持的平台列表"""
    platforms = []
    for key, config in PLATFORM_CONFIGS.items():
        platforms.append({
            'type': config.get('type'),
            'key': key,
            'name': config.get('platform_name', key),
            'features': config.get('features', {}),
        })
    return jsonify({'code': 200, 'msg': 'success', 'data': platforms})


# ==================== 文件/素材管理 ====================

@app.route('/files/upload', methods=['POST'])
@require_api_key
def upload_save():
    """上传文件并写入数据库"""
    if 'file' not in request.files:
        return jsonify({'code': 400, 'msg': 'No file part', 'data': None}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'code': 400, 'msg': 'No selected file', 'data': None}), 400

    custom_filename = request.form.get('filename', None)
    if custom_filename:
        # 前端显式传的原始文件名(UTF-8)。若已含扩展名则直接使用,避免 'xxx.png.png' 重复。
        if '.' in custom_filename:
            filename = custom_filename
        else:
            ext = file.filename.split('.')[-1] if '.' in file.filename else ''
            filename = f"{custom_filename}.{ext}" if ext else custom_filename
    else:
        filename = file.filename

    # Werkzeug 对 multipart 文件名(Content-Disposition)默认按 latin-1 解码,
    # 中文文件名会变乱码。若原始字节是合法 UTF-8,重新解码还原中文;否则保留原样。
    if filename:
        try:
            repaired = filename.encode('latin-1').decode('utf-8')
            filename = repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass

    try:
        uuid_v1 = uuid.uuid1()
        final_filename = f"{uuid_v1}_{filename}"
        filepath = UPLOAD_DIR / final_filename
        file.save(str(filepath))

        file_size_mb = round(os.path.getsize(filepath) / (1024 * 1024), 2)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO file_records (filename, filesize, file_path) VALUES (?, ?, ?)',
                (filename, file_size_mb, final_filename)
            )
            conn.commit()
            file_id = cursor.lastrowid

        return jsonify({
            'code': 200,
            'msg': 'success',
            'data': {
                'id': file_id,
                'filename': filename,
                'filepath': final_filename,
                'filesize': file_size_mb,
                'url': f'/files/preview/{final_filename}',
            }
        }), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/files', methods=['GET'])
@require_api_key
def get_all_files():
    """获取所有素材列表"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM file_records ORDER BY id DESC')
            rows = cursor.fetchall()
            data = []
            for row in rows:
                row_dict = dict(row)
                file_path = row_dict.get('file_path', '')
                row_dict['url'] = f'/files/preview/{file_path}'
                data.append(row_dict)
            return jsonify({'code': 200, 'msg': 'success', 'data': data}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/files/<int:file_id>', methods=['DELETE'])
@require_api_key
def delete_file(file_id):
    """删除素材文件"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM file_records WHERE id = ?', (file_id,))
            record = cursor.fetchone()
            if not record:
                return jsonify({'code': 404, 'msg': 'File not found', 'data': None}), 404

            record = dict(record)
            file_path = UPLOAD_DIR / record['file_path']
            if file_path.exists():
                file_path.unlink()

            cursor.execute('DELETE FROM file_records WHERE id = ?', (file_id,))
            conn.commit()

        return jsonify({
            'code': 200, 'msg': 'success',
            'data': {'id': record['id'], 'filename': record['filename']}
        }), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/files/preview/<path:filename>', methods=['GET'])
@require_api_key
def get_file(filename):
    """获取文件（预览/下载）"""
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': 'Invalid filename'}), 400
    return send_from_directory(str(UPLOAD_DIR), filename)


@app.route('/stats/file', methods=['GET'])
@require_api_key
def get_file_stats():
    """文件统计"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) as total_files, SUM(filesize) as total_size,
                       AVG(filesize) as avg_size, MAX(filesize) as max_size
                FROM file_records
            ''')
            size_stats = cursor.fetchone()
            cursor.execute('SELECT * FROM file_records ORDER BY id DESC LIMIT 10')
            recent_files = [dict(row) for row in cursor.fetchall()]
            return jsonify({
                'code': 200, 'msg': 'success',
                'data': {
                    'size_stats': dict(size_stats) if size_stats else {},
                    'recent_files': recent_files,
                }
            }), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/stats/platform', methods=['GET'])
@require_api_key
def get_platform_stats():
    """平台账号统计"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT type, COUNT(*) as count,
                       SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as valid_count
                FROM user_info GROUP BY type
            ''')
            platform_stats = [dict(row) for row in cursor.fetchall()]

            cursor.execute('''
                SELECT COUNT(*) as total_accounts,
                       SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as valid_accounts,
                       (SELECT COUNT(*) FROM file_records) as total_files
                FROM user_info
            ''')
            overall = dict(cursor.fetchone())
            return jsonify({
                'code': 200, 'msg': 'success',
                'data': {'platform_stats': platform_stats, 'overall': overall}
            }), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


# ==================== 账号管理 ====================

@app.route('/accounts', methods=['GET'])
@require_api_key
def get_accounts():
    """获取所有账号（快速，不验证）"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM user_info ORDER BY id DESC')
            rows = [dict(row) for row in cursor.fetchall()]
            return jsonify({'code': 200, 'msg': 'success', 'data': rows}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/accounts/valid', methods=['GET'])
@require_api_key
def get_valid_accounts():
    """获取所有账号（并发验证cookie有效性）"""
    try:
        platform_type = request.args.get('type', type=int, default=0)

        with get_db() as conn:
            cursor = conn.cursor()
            if platform_type == 0:
                cursor.execute('SELECT * FROM user_info')
            else:
                cursor.execute('SELECT * FROM user_info WHERE type = ?', (platform_type,))
            rows = [dict(row) for row in cursor.fetchall()]

        CONCURRENCY_LIMIT = 10

        async def check_and_update(row):
            try:
                flag = await check_cookie(row['type'], row['filePath'])
                status = 1 if flag else 0
                return row['id'], status
            except Exception as e:
                print(f"验证账号 {row['userName']} 出错: {e}")
                return row['id'], 0

        def chunked(lst, n):
            for i in range(0, len(lst), n):
                yield lst[i:i + n]

        def run_checks():
            accounts_to_update = []
            for batch in chunked(rows, CONCURRENCY_LIMIT):
                tasks = [check_and_update(row) for row in batch]
                results = asyncio.run(asyncio.gather(*tasks, return_exceptions=True))
                for r in results:
                    if not isinstance(r, Exception) and r is not None:
                        accounts_to_update.append(r)
            return accounts_to_update

        accounts_to_update = run_checks()

        if accounts_to_update:
            with get_db() as conn:
                cursor = conn.cursor()
                for acc_id, status in accounts_to_update:
                    cursor.execute('UPDATE user_info SET status = ? WHERE id = ?', (status, acc_id))
                conn.commit()

            for row in rows:
                for acc_id, status in accounts_to_update:
                    if row['id'] == acc_id:
                        row['status'] = status
                        break

        return jsonify({'code': 200, 'msg': 'success', 'data': rows}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/accounts/<int:account_id>', methods=['PUT'])
@require_api_key
def update_account(account_id):
    """更新账号信息"""
    data = request.get_json()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            if 'userName' in data:
                cursor.execute(
                    'UPDATE user_info SET userName = ? WHERE id = ?',
                    (data['userName'], account_id)
                )
            if 'type' in data:
                cursor.execute(
                    'UPDATE user_info SET type = ? WHERE id = ?',
                    (data['type'], account_id)
                )
            conn.commit()
        return jsonify({'code': 200, 'msg': 'success', 'data': None}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/accounts/<int:account_id>', methods=['DELETE'])
@require_api_key
def delete_account_route(account_id):
    """删除账号"""
    result = delete_account(account_id)
    code = result.get('code', 500)
    status_code = 200 if code == 200 else (404 if code == 404 else 500)
    return jsonify(result), status_code


@app.route('/accounts/<int:account_id>/verify', methods=['POST'])
@require_api_key
def verify_account(account_id):
    """验证单个账号cookie有效性"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM user_info WHERE id = ?', (account_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({'code': 404, 'msg': 'Account not found', 'data': None}), 404
            row = dict(row)

        valid = asyncio.run(check_cookie(row['type'], row['filePath']))
        status = 1 if valid else 0

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE user_info SET status = ? WHERE id = ?', (status, account_id))
            conn.commit()

        return jsonify({
            'code': 200, 'msg': 'success',
            'data': {'id': account_id, 'valid': valid, 'status': status}
        }), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


# ==================== SSE 登录 ====================

@app.route('/login/stream')
@require_api_key
def login_unified():
    """统一登录接口（SSE 流）
    参数：type=平台类型编号, id=账号名
    """
    type_param = request.args.get('type')
    account_id = request.args.get('id')

    if not type_param or not account_id:
        return jsonify({'code': 400, 'msg': 'Missing type or id', 'data': None}), 400

    # 如果账号已存在，先删除原记录
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM user_info WHERE userName = ? AND type = ?',
                       (account_id, type_param))
        row = cursor.fetchone()
        if row:
            delete_account(row['id'])

    status_queue = Queue()
    active_queues[account_id] = status_queue

    thread = threading.Thread(
        target=run_unified_login,
        args=(type_param, account_id, status_queue),
        daemon=True
    )
    thread.start()

    def generate():
        try:
            while True:
                if not status_queue.empty():
                    msg = status_queue.get()
                    yield f"data: {msg}\n\n"
                else:
                    time.sleep(0.1)
        except GeneratorExit:
            active_queues.pop(account_id, None)

    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers['Content-Type'] = 'text/event-stream'
    response.headers['Connection'] = 'keep-alive'
    return response


# ==================== Cookie 管理 ====================

@app.route('/cookie/upload', methods=['POST'])
@require_api_key
def upload_cookie():
    """上传 Cookie 文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'code': 400, 'msg': 'No cookie file', 'data': None}), 400
        file = request.files['file']
        if not file.filename.endswith('.json'):
            return jsonify({'code': 400, 'msg': 'Cookie must be JSON', 'data': None}), 400

        account_id = request.form.get('id')
        if not account_id:
            return jsonify({'code': 400, 'msg': 'Missing account id', 'data': None}), 400

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT filePath FROM user_info WHERE id = ?', (account_id,))
            result = cursor.fetchone()
            if not result:
                return jsonify({'code': 404, 'msg': 'Account not found', 'data': None}), 404

        cookie_file_path = COOKIE_DIR / result['filePath']
        cookie_file_path.parent.mkdir(parents=True, exist_ok=True)
        file.save(str(cookie_file_path))

        return jsonify({'code': 200, 'msg': 'success', 'data': None}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/cookie/download', methods=['GET'])
@require_api_key
def download_cookie():
    """下载 Cookie 文件"""
    file_path = request.args.get('filePath')
    if not file_path:
        return jsonify({'code': 400, 'msg': 'Missing filePath', 'data': None}), 400

    cookie_file_path = (COOKIE_DIR / file_path).resolve()
    base_path = COOKIE_DIR.resolve()
    if not str(cookie_file_path).startswith(str(base_path)):
        return jsonify({'code': 400, 'msg': 'Invalid path', 'data': None}), 400

    if not cookie_file_path.exists():
        return jsonify({'code': 404, 'msg': 'File not found', 'data': None}), 404

    return send_from_directory(
        directory=str(cookie_file_path.parent),
        path=cookie_file_path.name,
        as_attachment=True
    )


# ==================== 发布任务记录 ====================

@app.route('/tasks', methods=['GET'])
@require_api_key
def get_publish_task_records():
    """获取发布任务记录（分页）"""
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 10))
        status = request.args.get('status')
        platform_name = request.args.get('platform_name')
        account_name = request.args.get('account_name')
        filename = request.args.get('filename')

        conditions = []
        params = []
        if status:
            conditions.append('status = ?')
            params.append(status)
        if platform_name:
            conditions.append('platform_name = ?')
            params.append(platform_name)
        if account_name:
            conditions.append('account_name LIKE ?')
            params.append(f'%{account_name}%')
        if filename:
            conditions.append('filename LIKE ?')
            params.append(f'%{filename}%')

        where_clause = f'WHERE {" AND ".join(conditions)}' if conditions else ''

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f'SELECT COUNT(*) as total FROM publish_task_records {where_clause}', params)
            total = cursor.fetchone()['total']

            offset = (page - 1) * page_size
            cursor.execute(f'''
                SELECT * FROM publish_task_records {where_clause}
                ORDER BY create_time DESC LIMIT ? OFFSET ?
            ''', params + [page_size, offset])
            records = [dict(row) for row in cursor.fetchall()]

        return jsonify({
            'code': 200, 'msg': 'success',
            'data': {'records': records, 'total': total, 'page': page, 'pageSize': page_size}
        }), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/tasks/<int:task_id>/status', methods=['PUT'])
@require_api_key
def update_publish_task_status(task_id):
    """更新任务状态"""
    data = request.get_json()
    status = data.get('status')
    error_msg = data.get('errorMsg')
    if not status:
        return jsonify({'code': 400, 'msg': 'Missing status', 'data': None}), 400

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            if error_msg:
                cursor.execute('''
                    UPDATE publish_task_records
                    SET status = ?, error_msg = ?, update_time = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', [status, error_msg, task_id])
            else:
                cursor.execute('''
                    UPDATE publish_task_records
                    SET status = ?, update_time = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', [status, task_id])
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({'code': 404, 'msg': 'Task not found', 'data': None}), 404
        return jsonify({'code': 200, 'msg': 'success', 'data': None}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/tasks/<int:task_id>/retry', methods=['POST'])
@require_api_key
def retry_publish_task(task_id):
    """重试发布任务"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM publish_task_records WHERE id = ?', (task_id,))
            record = cursor.fetchone()
            if not record:
                return jsonify({'code': 404, 'msg': 'Task not found', 'data': None}), 404

            cursor.execute('''
                UPDATE publish_task_records
                SET status = '发布中', error_msg = NULL, update_time = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', [task_id])
            conn.commit()

        # TODO: 实际执行重试（在子线程中调用发布函数）
        return jsonify({'code': 200, 'msg': 'retry queued', 'data': None}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/tasks/<int:task_id>/cancel', methods=['POST'])
@require_api_key
def cancel_publish_task(task_id):
    """取消发布任务"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM publish_task_records WHERE id = ?', (task_id,))
            record = cursor.fetchone()
            if not record:
                return jsonify({'code': 404, 'msg': 'Task not found', 'data': None}), 404

            record = dict(record)
            if record['status'] not in ['发布中', '待发布']:
                return jsonify({
                    'code': 400,
                    'msg': f"Only pending/publishing tasks can be cancelled, current: {record['status']}",
                    'data': None
                }), 400

            cursor.execute('''
                UPDATE publish_task_records
                SET status = '已取消', update_time = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', [task_id])
            conn.commit()

        return jsonify({'code': 200, 'msg': 'success', 'data': None}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/tasks/<int:task_id>', methods=['DELETE'])
@require_api_key
def delete_publish_task(task_id):
    """删除发布任务记录"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM publish_task_records WHERE id = ?', (task_id,))
            if not cursor.fetchone():
                return jsonify({'code': 404, 'msg': 'Task not found', 'data': None}), 404
            cursor.execute('DELETE FROM publish_task_records WHERE id = ?', (task_id,))
            conn.commit()
        return jsonify({'code': 200, 'msg': 'success', 'data': None}), 200
    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


# ==================== 发布管理 ====================

@app.route('/publish/single', methods=['POST'])
@require_api_key
def post_video():
    """发布到单个平台（单文件或多文件，支持多账号）"""
    try:
        data = request.get_json()
        type_num = data.get('type')
        account_list = data.get('accountList', [])
        file_type = data.get('fileType', 2)  # 1=图文, 2=视频
        file_list = data.get('fileList', [])
        title = data.get('title', '')
        text = data.get('text', '')
        tags = data.get('tags', '')
        thumbnail_path = data.get('thumbnail', '')
        location = data.get('location', 1)
        enable_timer = data.get('enableTimer', 0)
        videos_per_day = data.get('videosPerDay', 1)
        daily_times = data.get('dailyTimes', [])
        start_days = data.get('startDays', 0)

        platform = get_platform_key_by_type(type_num)
        if not platform:
            return jsonify({'code': 400, 'msg': 'Invalid platform type', 'data': None}), 400

        # debug: 记录收到 title/text 的码点,排查中文乱码是传输还是输入问题
        with open('publish_debug.txt', 'a', encoding='utf-8') as pdf:
            pdf.write(f'title: {title!r}\n')
            pdf.write(f'text: {text!r}\n')
            pdf.write(f'tags: {tags!r}\n')

        task_id = str(uuid.uuid4())

        # 解析素材:优先用 fileId 从数据库查真实 file_path(DB 存的是正确中文,
        # 避免前端文件名经 Node→Python 传输时中文乱码导致 Playwright 找不到文件)。
        # 回退:直接取 fileName(兼容旧调用)。
        with get_db() as conn:
            cursor = conn.cursor()
            resolved_files = []
            for file_info in file_list:
                file_path = None
                if isinstance(file_info, dict):
                    fid = file_info.get('fileId')
                    if fid:
                        cursor.execute('SELECT file_path FROM file_records WHERE id = ?', (fid,))
                        row = cursor.fetchone()
                        if row:
                            file_path = row[0]
                    if not file_path:
                        file_path = file_info.get('fileName', '')
                else:
                    file_path = file_info
                resolved_files.append(file_path)

        # 创建任务记录
        with get_db() as conn:
            cursor = conn.cursor()
            for account in account_list:
                account_file = account.get('filePath', '') if isinstance(account, dict) else account
                account_name = account.get('userName', account_file) if isinstance(account, dict) else account_file
                for file_path in resolved_files:
                    if '_' in file_path:
                        parts = file_path.split('_', 1)
                        file_id = parts[0]
                        real_filename = parts[1]
                    else:
                        file_id = None
                        real_filename = file_path

                    cursor.execute('''
                        INSERT INTO publish_task_records (
                            task_id, filename, file_id, account_id, account_name,
                            platform_name, platform_type, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, '发布中')
                    ''', [task_id, real_filename, file_id, account_file, account_name,
                          platform, type_num])
            conn.commit()

        # post_file 期望纯字符串列表: cookie文件名 / 文件相对路径,需从字典中提取
        account_files = [
            a.get('filePath', '') if isinstance(a, dict) else a
            for a in account_list
        ]
        # 执行发布（同步阻塞，后续可优化为异步任务队列）
        result = post_file(
            platform, account_files, file_type, resolved_files,
            title, text, tags, thumbnail_path, location,
            enable_timer, videos_per_day, daily_times, start_days
        )

        status = '发布成功' if result else '发布失败'
        error_msg = None
        if not result:
            # 取发布任务的错误详情:multiFileUploader 内部记录在 baseFileUploader 日志,
            # 这里补一个平台级提示,便于定位
            error_msg = f'{platform} 发布失败(浏览器上传未成功),请检查账号Cookie是否有效'
        with get_db() as conn:
            cursor = conn.cursor()
            if error_msg:
                cursor.execute('''
                    UPDATE publish_task_records
                    SET status = ?, error_msg = ?, update_time = CURRENT_TIMESTAMP
                    WHERE task_id = ?
                ''', [status, error_msg, task_id])
            else:
                cursor.execute('''
                    UPDATE publish_task_records
                    SET status = ?, update_time = CURRENT_TIMESTAMP
                    WHERE task_id = ?
                ''', [status, task_id])
            conn.commit()

        return jsonify({
            'code': 200 if result else 500,
            'msg': 'success' if result else error_msg,
            'data': {'task_id': task_id, 'status': status, 'error': error_msg}
        }), 200 if result else 500

    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


@app.route('/publish/batch', methods=['POST'])
@require_api_key
def post_videos_to_multiple_platforms():
    """批量发布多文件到多平台"""
    try:
        data = request.get_json()
        platforms = data.get('platforms', [])
        account_files = data.get('accountFiles', {})
        file_type = data.get('fileType', 2)
        files = data.get('files', [])
        title = data.get('title', '')
        text = data.get('text', '')
        tags = data.get('tags', '')
        thumbnail_path = data.get('thumbnail', '')
        location = data.get('location', 1)
        enable_timer = data.get('enableTimer', 0)
        videos_per_day = data.get('videosPerDay', 1)
        daily_times = data.get('dailyTimes', [])
        start_days = data.get('startDays', 0)

        task_id = str(uuid.uuid4())

        # 过滤账号（确保账号类型与平台匹配）
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT filePath, type FROM user_info')
            rows = cursor.fetchall()
            file_type_map = {row[0]: row[1] for row in rows}

        filtered_account_files = {}
        for platform, acct_files in account_files.items():
            platform_type = get_type_by_platform_key(platform)
            if platform_type is None:
                filtered_account_files[platform] = []
                continue
            filtered = [f for f in acct_files if f in file_type_map and file_type_map[f] == platform_type]
            filtered_account_files[platform] = filtered

        # 创建任务记录
        with get_db() as conn:
            cursor = conn.cursor()
            for platform in platforms:
                platform_type = get_type_by_platform_key(platform)
                acct_files = filtered_account_files.get(platform, [])
                for acct_file in acct_files:
                    acct_name = acct_file
                    cursor.execute('SELECT userName FROM user_info WHERE filePath = ?', (acct_file,))
                    row = cursor.fetchone()
                    if row:
                        acct_name = row[0]
                    for f in files:
                        filename = f
                        if '_' in filename:
                            parts = filename.split('_', 1)
                            file_id = parts[0]
                            real_filename = parts[1]
                        else:
                            file_id = None
                            real_filename = filename

                        cursor.execute('''
                            INSERT INTO publish_task_records (
                                task_id, filename, file_id, account_id, account_name,
                                platform_name, platform_type, status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, '发布中')
                        ''', [task_id, real_filename, file_id, acct_file, acct_name,
                              platform, platform_type])
            conn.commit()

        # 执行批量发布
        result = post_multiple_files_to_multiple_platforms(
            platforms, filtered_account_files, file_type, files,
            title, text, tags, thumbnail_path, location,
            enable_timer, videos_per_day, daily_times, start_days
        )

        # 更新状态
        success_count = 0
        total_count = 0
        for platform_key, info in result.items() if isinstance(result, dict) else {}:
            total_count += info.get('total', 0)
            success_count += info.get('success', 0)

        status = '发布成功' if success_count > 0 else '发布失败'
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE publish_task_records
                SET status = ?, update_time = CURRENT_TIMESTAMP
                WHERE task_id = ?
            ''', [status, task_id])
            conn.commit()

        return jsonify({
            'code': 200,
            'msg': 'batch publish completed',
            'data': {'task_id': task_id, 'result': result, 'status': status}
        }), 200

    except Exception as e:
        return jsonify({'code': 500, 'msg': str(e), 'data': None}), 500


# ==================== 启动 ====================

if __name__ == '__main__':
    init_db()
    print(f"[OK] Media Publisher service starting on {HOST}:{PORT}")
    print(f"[OK] Upload dir: {UPLOAD_DIR}")
    print(f"[OK] Cookie dir: {COOKIE_DIR}")
    print(f"[OK] DB path: {DB_PATH}")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
