-- 业务/门店/模板/工作簿
CREATE TABLE IF NOT EXISTS business (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop (
  id SERIAL PRIMARY KEY,
  business_id INT NOT NULL REFERENCES business(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS template (
  id SERIAL PRIMARY KEY,
  business_id INT NOT NULL REFERENCES business(id),
  version INT NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, version)
);
CREATE TABLE IF NOT EXISTS workbook (
  id SERIAL PRIMARY KEY,
  shop_id INT NOT NULL REFERENCES shop(id),
  period TEXT NOT NULL,            -- YYYY-MM
  univer_unit_id TEXT,
  template_version INT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, period)
);
CREATE TABLE IF NOT EXISTS workbook_snapshot (
  workbook_id INT PRIMARY KEY REFERENCES workbook(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 业务事实表
CREATE TABLE IF NOT EXISTS daily_metric (
  id SERIAL PRIMARY KEY,
  shop_id INT NOT NULL REFERENCES shop(id),
  date DATE NOT NULL,
  business_code TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  source_workbook_id INT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_metric_metrics ON daily_metric USING GIN (metrics);
-- 大屏全店 KPI/趋势按 date BETWEEN 过滤(无 shop_id),补 date 索引支撑。
CREATE INDEX IF NOT EXISTS idx_daily_metric_date ON daily_metric(date);

CREATE TABLE IF NOT EXISTS expense (
  id SERIAL PRIMARY KEY,
  shop_id INT NOT NULL REFERENCES shop(id),
  pay_date DATE,
  attribution_month TEXT,
  summary TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payee TEXT,
  subject TEXT,
  extra JSONB NOT NULL DEFAULT '{}',
  source_workbook_id INT,
  source_row INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 权限与日志
CREATE TABLE IF NOT EXISTS app_user (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('chairman','manager','employee')),
  department TEXT,
  phone TEXT,
  last_login_ip TEXT,
  last_login_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_by INT REFERENCES app_user(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operation_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT,
  user_name TEXT,
  ip TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail JSONB NOT NULL DEFAULT '{}',
  result TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operation_log_created ON operation_log (created_at);
CREATE INDEX IF NOT EXISTS idx_operation_log_user ON operation_log (user_id);

-- 悲观锁(02 子计划用)
CREATE TABLE IF NOT EXISTS sheet_lock (
  workbook_id INT NOT NULL REFERENCES workbook(id) ON DELETE CASCADE,
  sheet_key TEXT NOT NULL,
  user_id INT NOT NULL REFERENCES app_user(id),
  user_name TEXT NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workbook_id, sheet_key)
);

-- 02 悲观锁:接管请求字段(两阶段交接--持有者保存后让出)
ALTER TABLE sheet_lock ADD COLUMN IF NOT EXISTS request_user_id INT REFERENCES app_user(id);
ALTER TABLE sheet_lock ADD COLUMN IF NOT EXISTS request_user_name TEXT;

-- 03 大屏:门店月度目标(任务完成进度用)
ALTER TABLE shop ADD COLUMN IF NOT EXISTS monthly_target NUMERIC NOT NULL DEFAULT 0;

-- 04 海报:企业 logo(全局共享,不绑定店铺) + 门店联系信息(按店铺各一份)
ALTER TABLE shop ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE shop ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE TABLE IF NOT EXISTS poster_logo (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,        -- 磁盘存储名(随机 id + 扩展名)
  original_name TEXT NOT NULL,   -- 用户上传时的原始文件名
  mime TEXT NOT NULL,
  size INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 子项目1:工作簿软删除(保留 snapshot 与已同步 metric,大屏数据不受影响)
ALTER TABLE workbook ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_workbook_shop_period_live ON workbook(shop_id, period) WHERE deleted_at IS NULL;

-- 子项目3:AI 抽取管线溯源 + 调度跳过标记
ALTER TABLE workbook ADD COLUMN IF NOT EXISTS last_extracted_at TIMESTAMPTZ;  -- 上次 AI 抽取时间(调度跳过 + /status)
ALTER TABLE daily_metric ADD COLUMN IF NOT EXISTS last_source TEXT;            -- 'ai'(替代 sync 后唯一来源,留字段备查)
ALTER TABLE expense ADD COLUMN IF NOT EXISTS source TEXT;                      -- 'ai'
