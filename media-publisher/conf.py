import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# BASE_DIR 指向 media-publisher 目录
BASE_DIR = Path(__file__).parent.resolve()

# 服务配置
PORT = int(os.getenv('MEDIA_PORT', '5409'))
HOST = os.getenv('MEDIA_HOST', '0.0.0.0')
API_KEY = os.getenv('MEDIA_API_KEY', '')  # 服务间调用鉴权

# 浏览器配置
LOCAL_CHROME_PATH = os.getenv('LOCAL_CHROME_PATH', 'C:/Program Files/Google/Chrome/Application/chrome.exe')
LOCAL_CHROME_HEADLESS = os.getenv('LOCAL_CHROME_HEADLESS', 'False').lower() == 'true'

# 文件存储路径
UPLOAD_DIR = Path(os.getenv('MEDIA_UPLOAD_DIR', str(BASE_DIR / 'videoFile')))
COOKIE_DIR = Path(os.getenv('MEDIA_COOKIE_DIR', str(BASE_DIR / 'cookiesFile')))
DB_PATH = Path(os.getenv('MEDIA_DB_PATH', str(BASE_DIR / 'db' / 'database.db')))

# 确保目录存在
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
COOKIE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

XHS_SERVER = os.getenv('XHS_SERVER', 'http://127.0.0.1:11901')
