module.exports = {
  apps: [
    {
      name: 'hris-backend',
      script: './hris-backend/src/server.js',
      cwd: '/var/www/hris-barokah',
      
      // PERINGATAN KRUSIAL: SQLite tidak mendukung write-concurrency paralel di banyak thread.
      // Mode wajib diatur ke 'fork' dengan instances 1 untuk menghindari database corruption / locked.
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart Kebijakan
      watch: false,
      max_memory_restart: '250M',
      autorestart: true,
      restart_delay: 2000,

      // Manajemen Berkas Log
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Variabel Lingkungan Produksi
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_FILE: './hris-backend/database.sqlite',
        ALLOWED_ORIGINS: 'https://admin.hrisbarokah.com'
      }
    }
  ]
};
