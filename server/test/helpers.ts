import { query } from '../src/db/pool.js';

// 清空所有业务表(顺序无关,TRUNCATE CASCADE 处理外键),RESTART IDENTITY 重置自增
export const resetDb = () =>
  query(
    'TRUNCATE sheet_lock, expense, daily_metric, workbook_snapshot, workbook, operation_log, app_user, template, shop, business RESTART IDENTITY CASCADE',
  );
