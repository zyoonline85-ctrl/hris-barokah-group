import mysql from 'mysql2/promise';
import { config } from './env.js';
import { AsyncLocalStorage } from 'async_hooks';

// Setup AsyncLocalStorage untuk melacak koneksi dalam satu request context (transaksi)
export const transactionContext = new AsyncLocalStorage();

// Konfigurasi parameter pool MySQL dari environment
const pool = mysql.createPool({
  host: config.dbHost || '127.0.0.1',
  user: config.dbUser || 'root',
  password: config.dbPassword || '',
  database: config.dbName || 'hris_barokah',
  port: parseInt(config.dbPort || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10, // Menghindari exhaustion batas maksimal koneksi MySQL
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

console.log(`MySQL Connection Pool diinisialisasi ke host: ${config.dbHost || '127.0.0.1'}`);

/**
 * Mendapatkan client eksekusi aktif (koneksi transaksi spesifik atau pool global)
 */
async function getExecuteClient() {
  const store = transactionContext.getStore();
  if (store && store.has('connection')) {
    return store.get('connection');
  }
  return pool;
}

// Wrapper kompatibilitas tinggi (Drop-in Replacement untuk dbQuery lama)
export const dbQuery = {
  /**
   * Operasi tulis (INSERT, UPDATE, DELETE)
   * Memetakan insertId -> id dan affectedRows -> changes agar controllers lama tidak pecah.
   */
  async run(sql, params = []) {
    try {
      const sqlTrimmed = sql.trim().toUpperCase();
      const store = transactionContext.getStore();

      if (store) {
        // Intersepsi sintaks transaksi SQLite -> MySQL
        if (sqlTrimmed.startsWith('BEGIN TRANSACTION') || sqlTrimmed.startsWith('START TRANSACTION') || sqlTrimmed === 'BEGIN') {
          if (store.has('connection')) {
            throw new Error('Transaction already in progress in this context');
          }
          const conn = await pool.getConnection();
          await conn.beginTransaction();
          store.set('connection', conn);
          return { id: null, changes: 0 };
        }

        if (sqlTrimmed === 'COMMIT') {
          const conn = store.get('connection');
          if (!conn) {
            throw new Error('No active transaction to commit');
          }
          await conn.commit();
          conn.release();
          store.delete('connection');
          return { id: null, changes: 0 };
        }

        if (sqlTrimmed === 'ROLLBACK') {
          const conn = store.get('connection');
          if (!conn) {
            return { id: null, changes: 0 };
          }
          await conn.rollback();
          conn.release();
          store.delete('connection');
          return { id: null, changes: 0 };
        }
      }

      const client = await getExecuteClient();
      const [result] = await client.execute(sql, params);
      return {
        id: result.insertId || null,
        changes: result.affectedRows !== undefined ? result.affectedRows : 0
      };
    } catch (error) {
      console.error(`Database execute error: ${sql}`, error.message);
      throw error;
    }
  },

  /**
   * Mengambil baris pertama (SELECT LIMIT 1)
   */
  async get(sql, params = []) {
    try {
      const client = await getExecuteClient();
      const [rows] = await client.execute(sql, params);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error(`Database query get error: ${sql}`, error.message);
      throw error;
    }
  },

  /**
   * Mengambil seluruh data (SELECT)
   */
  async all(sql, params = []) {
    try {
      const client = await getExecuteClient();
      const [rows] = await client.execute(sql, params);
      return rows;
    } catch (error) {
      console.error(`Database query all error: ${sql}`, error.message);
      throw error;
    }
  }
};

/**
 * Fungsi inisialisasi hanya untuk memeriksa konektivitas saat booting backend.
 * DDL skema database akan didelegasikan secara terpisah lewat skrip migrasi mandiri.
 */
export async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('SUCCESS: Berhasil terhubung ke database MySQL.');
    
    // Pastikan tabel mobile_user_notifications memiliki kolom response dan read_at
    try {
      await connection.execute("ALTER TABLE mobile_user_notifications ADD COLUMN response VARCHAR(255) NULL");
      console.log('SUCCESS: Menambahkan kolom response ke tabel mobile_user_notifications.');
    } catch (_) {}
    try {
      await connection.execute("ALTER TABLE mobile_user_notifications ADD COLUMN read_at TIMESTAMP NULL");
      console.log('SUCCESS: Menambahkan kolom read_at ke tabel mobile_user_notifications.');
    } catch (_) {}
    try {
      await connection.execute("ALTER TABLE employees ADD COLUMN photo_url VARCHAR(500) NULL");
      console.log('SUCCESS: Menambahkan kolom photo_url ke tabel employees.');
    } catch (_) {}
    try {
      await connection.execute("ALTER TABLE outlets ADD COLUMN latitude DECIMAL(11, 8) NULL");
      console.log('SUCCESS: Menambahkan kolom latitude ke tabel outlets.');
    } catch (_) {}
    try {
      await connection.execute("ALTER TABLE outlets ADD COLUMN longitude DECIMAL(11, 8) NULL");
      console.log('SUCCESS: Menambahkan kolom longitude ke tabel outlets.');
    } catch (_) {}
    try {
      await connection.execute("ALTER TABLE outlets ADD COLUMN radius INT NULL");
      console.log('SUCCESS: Menambahkan kolom radius ke tabel outlets.');
    } catch (_) {}

    // Pastikan tabel surveys ada
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS surveys (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          outlets TEXT NULL,
          questions TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'aktif',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('SUCCESS: Membuat/memastikan tabel surveys.');
    } catch (e) {
      console.error('ERROR: Gagal membuat tabel surveys:', e.message);
    }

    // Pastikan tabel survey_responses ada
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS survey_responses (
          id VARCHAR(50) PRIMARY KEY,
          survey_id VARCHAR(50) NOT NULL,
          employee_id INT NOT NULL,
          employee_name VARCHAR(255) NOT NULL,
          outlet VARCHAR(255) NULL,
          answers TEXT NOT NULL,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('SUCCESS: Membuat/memastikan tabel survey_responses.');
    } catch (e) {
      console.error('ERROR: Gagal membuat tabel survey_responses:', e.message);
    }

    // Pastikan kunci gemini_api_key terdaftar di system_settings
    try {
      const [rows] = await connection.execute("SELECT * FROM system_settings WHERE `key` = 'gemini_api_key'");
      if (!rows || rows.length === 0) {
        await connection.execute(
          "INSERT INTO system_settings (`key`, value, description) VALUES ('gemini_api_key', '', 'Kunci API Gemini untuk generator AI')"
        );
        console.log('SUCCESS: Menambahkan kunci gemini_api_key ke tabel system_settings.');
      }
    } catch (_) {}

    connection.release();
  } catch (error) {
    console.error('CRITICAL: Gagal membangun koneksi pool ke MySQL:', error.message);
    process.exit(1);
  }
}

export default pool;
