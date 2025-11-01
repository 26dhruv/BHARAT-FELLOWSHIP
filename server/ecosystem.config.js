/**
 * PM2 Ecosystem Configuration
 * For production deployment
 */
module.exports = {
  apps: [
    {
      name: 'our-voice-api',
      script: './src/index.js',
      instances: 2, // Cluster mode: 2 instances
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '500M',
      watch: false,
    },
    {
      name: 'etl-worker',
      script: './worker/queue-worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/etl-err.log',
      out_file: './logs/etl-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '300M',
    },
  ],
};

