import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    globals: true,
    // 测试共用同一个 PG,用单进程串行避免跨文件数据竞争
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
