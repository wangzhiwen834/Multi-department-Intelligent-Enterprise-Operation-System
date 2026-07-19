/**
 * PM2 生产环境进程配置
 * 用法：在 server/ 目录下执行  pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'ops-server',
      script: './dist/index.js',
      cwd: '/opt/ops/server',
      instances: 1,           // 单实例（服务器配置高可改为 'max' 启用多核）
      exec_mode: 'fork',      // cluster 模式在 express 下建议配合负载均衡使用
      env: {
        NODE_ENV: 'production',
      },
      // 日志
      log_file: '/var/log/ops/combined.log',
      out_file: '/var/log/ops/out.log',
      error_file: '/var/log/ops/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 自动重启策略
      min_uptime: '10s',
      max_restarts: 5,
      // 内存超限重启（防止泄漏）
      max_memory_restart: '512M',
      // 崩溃后延迟重启，避免刷日志
      restart_delay: 3000,
      //  watch 文件变化（生产环境建议关闭，手动部署时重启）
      watch: false,
      // 忽略重启的文件
      ignore_watch: ['node_modules', 'logs', 'dist'],
    },
  ],
};
