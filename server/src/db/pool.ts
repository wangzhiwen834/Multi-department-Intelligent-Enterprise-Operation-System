import pg, { type QueryResultRow } from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = <T extends QueryResultRow = any>(text: string, params?: unknown[]) =>
  pool.query<T>(text, params);
