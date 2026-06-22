import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from './env.js';

const dbPath = path.resolve(config.databaseFile);
console.log(`Connecting to SQLite database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('CRITICAL: Gagal menghubungkan ke database SQLite:', err.message);
    process.exit(1);
  }
  console.log('SUCCESS: Terhubung ke database SQLite.');
  
  // Optimasi performa database SQLite
  db.run("PRAGMA journal_mode=WAL", (err) => {
    if (err) console.error("Gagal mengaktifkan WAL mode:", err.message);
    else console.log("SUCCESS: SQLite WAL (Write-Ahead Logging) mode diaktifkan.");
  });
  db.run("PRAGMA synchronous=NORMAL");
  db.run("PRAGMA temp_store = MEMORY");
  db.run("PRAGMA cache_size = -10000"); // 10MB cache size
  db.run("PRAGMA mmap_size = 268435456"); // 256MB Memory Map
  db.run("PRAGMA foreign_keys = ON");
});

// Promisify database operations for async/await support
export const dbQuery = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

/**
 * Inisialisasi skema database dan tabel-tabel utama (Termasuk 10 Modul Baru)
 */
export async function initializeDatabase() {
  try {
    // Hapus permanen modul Broadcast (tabel informations dan information_reads)
    await dbQuery.run("DROP TABLE IF EXISTS information_reads");
    await dbQuery.run("DROP TABLE IF EXISTS informations");
    await dbQuery.run("DELETE FROM position_permissions WHERE module = 'informations'");

    // === TABEL INTI ===
    
    // 1. Tabel Users
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('owner', 'admin', 'employee')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Tabel Employees
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        nik TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        position TEXT NOT NULL,
        department TEXT NOT NULL,
        basic_salary REAL NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        joined_date TEXT NOT NULL,
        outlet TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Pastikan kolom outlet ada jika tabel sudah terbentuk sebelumnya
    try {
      await dbQuery.run("ALTER TABLE employees ADD COLUMN outlet TEXT");
    } catch (e) {
      // Abaikan jika kolom sudah ada
    }

    try {
      await dbQuery.run("ALTER TABLE employees ADD COLUMN gender TEXT CHECK(gender IN ('Pria', 'Wanita')) DEFAULT 'Pria'");
    } catch (e) {
      // Abaikan jika kolom sudah ada
    }

    // 3. Tabel Attendances
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS attendances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        clock_in TEXT,
        clock_out TEXT,
        lat_in REAL,
        lng_in REAL,
        lat_out REAL,
        lng_out REAL,
        status_in TEXT CHECK(status_in IN ('ontime', 'late')),
        photo_in_url TEXT,
        photo_out_url TEXT,
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(employee_id, date)
      )
    `);

    // Pastikan kolom jam_mulai_istirahat & jam_akhir_istirahat ada di tabel attendances
    try {
      await dbQuery.run("ALTER TABLE attendances ADD COLUMN jam_mulai_istirahat TEXT");
    } catch (e) {}
    try {
      await dbQuery.run("ALTER TABLE attendances ADD COLUMN jam_akhir_istirahat TEXT");
    } catch (e) {}

    // 4. Tabel Leaves
    let migrateLeaves = false;
    try {
      const info = await dbQuery.all("PRAGMA table_info(leaves)");
      if (info.length > 0 && !info.some(c => c.name === 'half_day_clock_out')) {
        migrateLeaves = true;
      }
    } catch (e) {}

    if (migrateLeaves) {
      console.log("MIGRATION: Migrating leaves table to support setengah_hari & kasbon...");
      await dbQuery.run("ALTER TABLE leaves RENAME TO leaves_old");
      await dbQuery.run(`
        CREATE TABLE leaves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL,
          leave_type TEXT CHECK(leave_type IN ('cuti', 'izin', 'sakit', 'setengah_hari', 'kasbon')) NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
          attachment_url TEXT,
          approved_by INTEGER,
          approval_date TEXT,
          half_day_clock_out TEXT,
          cash_advance_amount REAL,
          is_sent INTEGER DEFAULT 0 CHECK(is_sent IN (0, 1)),
          is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id)
        )
      `);
      await dbQuery.run(`
        INSERT INTO leaves (id, employee_id, leave_type, start_date, end_date, reason, status, attachment_url, approved_by, approval_date, created_at, is_sent, is_read)
        SELECT id, employee_id, leave_type, start_date, end_date, reason, status, attachment_url, approved_by, approval_date, created_at, 0, 0 FROM leaves_old
      `);
      await dbQuery.run("DROP TABLE leaves_old");
      console.log("SUCCESS: Leaves table migration complete.");
    } else {
      await dbQuery.run(`
        CREATE TABLE IF NOT EXISTS leaves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL,
          leave_type TEXT CHECK(leave_type IN ('cuti', 'izin', 'sakit', 'setengah_hari', 'kasbon')) NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
          attachment_url TEXT,
          approved_by INTEGER,
          approval_date TEXT,
          half_day_clock_out TEXT,
          cash_advance_amount REAL,
          is_sent INTEGER DEFAULT 0 CHECK(is_sent IN (0, 1)),
          is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id)
        )
      `);
    }

    // Dynamic Alter table to ensure is_sent and is_read columns exist
    try {
      const info = await dbQuery.all("PRAGMA table_info(leaves)");
      if (!info.some(c => c.name === 'is_sent')) {
        await dbQuery.run("ALTER TABLE leaves ADD COLUMN is_sent INTEGER DEFAULT 0 CHECK(is_sent IN (0, 1))");
        console.log("MIGRATION: Added 'is_sent' column to leaves table.");
      }
      if (!info.some(c => c.name === 'is_read')) {
        await dbQuery.run("ALTER TABLE leaves ADD COLUMN is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1))");
        console.log("MIGRATION: Added 'is_read' column to leaves table.");
      }
    } catch (e) {
      console.error("Migration error adding is_sent/is_read columns to leaves table:", e.message);
    }

    // 5. Tabel Payrolls
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS payrolls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        period TEXT NOT NULL,
        basic_salary REAL NOT NULL,
        allowances REAL DEFAULT 0,
        deductions REAL DEFAULT 0,
        net_salary REAL NOT NULL,
        payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid')),
        payment_date TEXT,
        slip_url TEXT,
        is_sent INTEGER DEFAULT 0 CHECK(is_sent IN (0, 1)),
        is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(employee_id, period)
      )
    `);

    // Migration untuk tabel payrolls jika sudah ada sebelumnya
    try {
      const info = await dbQuery.all("PRAGMA table_info(payrolls)");
      if (!info.some(c => c.name === 'is_sent')) {
        await dbQuery.run("ALTER TABLE payrolls ADD COLUMN is_sent INTEGER DEFAULT 0 CHECK(is_sent IN (0, 1))");
        console.log("MIGRATION: Added 'is_sent' column to payrolls table.");
      }
      if (!info.some(c => c.name === 'is_read')) {
        await dbQuery.run("ALTER TABLE payrolls ADD COLUMN is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1))");
        console.log("MIGRATION: Added 'is_read' column to payrolls table.");
      }
    } catch (e) {
      console.error("Migration error adding is_sent/is_read columns to payrolls table:", e.message);
    }

    // === TABEL EKSPANSI 10 MODUL BARU ===

    // 6. Tabel Outlets (Drop dan Recreate dengan Skema Baru)
    await dbQuery.run(`DROP TABLE IF EXISTS outlet_revenues`);
    await dbQuery.run(`DROP TABLE IF EXISTS outlets`);
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS outlets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama TEXT UNIQUE NOT NULL,
        wilayah TEXT NOT NULL,
        alamat TEXT NOT NULL,
        permodalan TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);


    // 7. Tabel Omzet Outlet (Outlet Revenues)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS outlet_revenues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outlet_id INTEGER NOT NULL,
        tanggal TEXT NOT NULL,
        jumlah_omzet REAL NOT NULL,
        dicatat_oleh INTEGER NOT NULL,
        FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
        FOREIGN KEY (dicatat_oleh) REFERENCES users(id)
      )
    `);

    // 8. Tabel SOP (Standard Operating Procedure)
    await dbQuery.run(`DROP TABLE IF EXISTS sops`);
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS sops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomor TEXT,
        judul TEXT NOT NULL,
        berlaku_di TEXT,
        jabatan_terkait TEXT,
        isi TEXT,
        keterangan_validasi TEXT,
        hanya_outlet_terpilih INTEGER DEFAULT 1,
        sasaran_role TEXT,
        tanggal_dibuat TEXT,
        status_kirim INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);



    // 11. Tabel KPI (Key Performance Indicator)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS kpis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        periode TEXT NOT NULL, -- Format: YYYY-MM
        skor_kpi REAL NOT NULL,
        evaluator_id INTEGER NOT NULL,
        catatan TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (evaluator_id) REFERENCES users(id),
        UNIQUE(employee_id, periode)
      )
    `);

    // 11b. Tabel Penilaian 360 (Ratings 360)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS ratings_360 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        kedisiplinan INTEGER NOT NULL,
        inisiatif INTEGER NOT NULL,
        kerjasama INTEGER NOT NULL,
        kebersihan INTEGER NOT NULL,
        etika INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    // 12. Tabel Sanksi / Tindakan Disiplin (Sanctions)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS sanctions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        tipe_sanksi TEXT CHECK(tipe_sanksi IN ('Surat Teguran Lisan 1', 'Surat Teguran Lisan 2', 'Surat Teguran Lisan 3', 'Surat Peringatan 1', 'Surat Peringatan 2', 'Surat Peringatan 3', 'PHK')) NOT NULL,
        bentuk_kesalahan TEXT CHECK(bentuk_kesalahan IN ('Pelanggaran Kode Etik', 'Pelanggaran Teknis')) NOT NULL,
        alasan TEXT NOT NULL,
        tanggal_berlaku TEXT NOT NULL,
        tanggal_berakhir TEXT NOT NULL,
        status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'selesai')),
        diketahui_oleh TEXT CHECK(diketahui_oleh IN ('SPV', 'Manajemen', 'General Manager')) NOT NULL,
        tanggal_terbit TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);



    // 13b. Tabel Dokumentasi Baru (PDF/Excel)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS documentations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal_publish TEXT NOT NULL,
        judul TEXT NOT NULL,
        isi TEXT NOT NULL,
        file_name TEXT,
        file_path TEXT,
        status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'tidak aktif')),
        status_kirim INTEGER DEFAULT 0,
        berlaku_di TEXT,
        jabatan_terkait TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13c. Tabel Jadwal Istirahat (Break Schedules)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS break_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        sesi INTEGER NOT NULL,
        jam_mulai TEXT NOT NULL,
        jam_selesai TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(employee_id, date)
      )
    `);

    // 13d. Tabel Notifikasi Mobile Karyawan (Mobile User Notifications)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS mobile_user_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        outlet TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    // 14. Tabel RBAC Permissions (Kontrol Akses Berbasis Peran)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS rbac_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT CHECK(role IN ('owner', 'admin', 'employee')) NOT NULL,
        permission_key TEXT NOT NULL,
        is_allowed INTEGER CHECK(is_allowed IN (0, 1)) DEFAULT 1,
        UNIQUE(role, permission_key)
      )
    `);

    // 15. Tabel Program Pelatihan (Trainings)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_program TEXT UNIQUE NOT NULL,
        divisi TEXT NOT NULL,
        tanggal_mulai TEXT NOT NULL,
        tanggal_selesai TEXT NOT NULL,
        kuota INTEGER DEFAULT 10,
        status TEXT DEFAULT 'mendatang' CHECK(status IN ('mendatang', 'berjalan', 'selesai')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 15. Tabel System Settings (Pengaturan Global Sistem)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT
      )
    `);

    // 16. Tabel Kebijakan Perusahaan (Policies)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_kebijakan TEXT NOT NULL,
        kategori TEXT CHECK(kategori IN ('jam_kerja', 'hari_libur', 'performa', 'lainnya')) NOT NULL,
        nilai TEXT NOT NULL,
        keterangan TEXT,
        efek_performa TEXT,
        status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif')),
        hanya_outlet_terpilih INTEGER DEFAULT 0,
        berlaku_di TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 17. Tabel Position Permissions (Manajemen Hak Akses Jabatan)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS position_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position TEXT NOT NULL,
        module TEXT NOT NULL,
        can_view INTEGER DEFAULT 0,
        can_edit INTEGER DEFAULT 0,
        can_delete INTEGER DEFAULT 0,
        UNIQUE(position, module)
      )
    `);

    // 18. Tabel Peak Days (Hari Sibuk)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS peak_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal INTEGER NOT NULL,
        bulan INTEGER NOT NULL,
        tahun INTEGER NOT NULL,
        nama_peak_day TEXT NOT NULL
      )
    `);

    // 19. Tabel Contracts (Kontrak Kerja / Surat Penugasan)
    await dbQuery.run(`
      CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomor_surat TEXT UNIQUE NOT NULL,
        employee_id INTEGER NOT NULL,
        jenis_kontrak TEXT CHECK(jenis_kontrak IN ('Surat Pengangkatan', 'Surat Perjanjian Kontrak', 'Surat Dinas', 'Surat Pemindahan Tugas', 'Surat Perintah')) NOT NULL,
        gaji_pokok REAL NOT NULL,
        uang_makan REAL NOT NULL,
        uang_lembur REAL NOT NULL,
        tunjangan_lama_bekerja REAL NOT NULL,
        tunjangan_keluarga REAL NOT NULL,
        tanggal_pembuatan TEXT NOT NULL,
        tanggal_selesai TEXT NOT NULL,
        status_persetujuan TEXT DEFAULT 'BELUM SIGN' CHECK(status_persetujuan IN ('BELUM SIGN', 'KONTRAK DITANDATANGANI')),
        keterangan TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    try {
      await dbQuery.run("ALTER TABLE policies ADD COLUMN hanya_outlet_terpilih INTEGER DEFAULT 0");
    } catch (e) {}
    try {
      await dbQuery.run("ALTER TABLE policies ADD COLUMN berlaku_di TEXT");
    } catch (e) {}
    try {
      await dbQuery.run("ALTER TABLE leaves ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    } catch (e) {}

    // Migration for sanctions table to new 7-type SP schema
    let migrateSanctions = false;
    try {
      const info = await dbQuery.all("PRAGMA table_info(sanctions)");
      if (info.length > 0 && !info.some(c => c.name === 'bentuk_kesalahan')) {
        migrateSanctions = true;
      }
    } catch (e) {}

    if (migrateSanctions) {
      console.log("MIGRATION: Migrating sanctions table to support corporate SP engine...");
      try {
        await dbQuery.run("DROP TABLE IF EXISTS sanctions_old");
        await dbQuery.run("ALTER TABLE sanctions RENAME TO sanctions_old");
        
        // Re-create sanctions table
        await dbQuery.run(`
          CREATE TABLE sanctions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            tipe_sanksi TEXT CHECK(tipe_sanksi IN ('Surat Teguran Lisan 1', 'Surat Teguran Lisan 2', 'Surat Teguran Lisan 3', 'Surat Peringatan 1', 'Surat Peringatan 2', 'Surat Peringatan 3', 'PHK')) NOT NULL,
            bentuk_kesalahan TEXT CHECK(bentuk_kesalahan IN ('Pelanggaran Kode Etik', 'Pelanggaran Teknis')) NOT NULL,
            alasan TEXT NOT NULL,
            tanggal_berlaku TEXT NOT NULL,
            tanggal_berakhir TEXT NOT NULL,
            status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'selesai')),
            diketahui_oleh TEXT CHECK(diketahui_oleh IN ('SPV', 'Manajemen', 'General Manager')) NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
          )
        `);

        // Migrate records
        const oldRows = await dbQuery.all("SELECT * FROM sanctions_old");
        for (const row of oldRows) {
          let tipe = 'Surat Teguran Lisan 1';
          let dik = 'SPV';
          let months = 3;
          
          if (row.tipe_sanksi === 'sp1') {
            tipe = 'Surat Peringatan 1';
            dik = 'Manajemen';
            months = 6;
          } else if (row.tipe_sanksi === 'sp2') {
            tipe = 'Surat Peringatan 2';
            dik = 'Manajemen';
            months = 6;
          } else if (row.tipe_sanksi === 'sp3') {
            tipe = 'Surat Peringatan 3';
            dik = 'General Manager';
            months = 6;
          }

          // Calculate berakhir date (Y-m-d)
          const start = new Date(row.tanggal_berlaku);
          start.setMonth(start.getMonth() + months);
          const berakhir = start.toISOString().split('T')[0];

          await dbQuery.run(`
            INSERT INTO sanctions (id, employee_id, tipe_sanksi, bentuk_kesalahan, alasan, tanggal_berlaku, tanggal_berakhir, status, diketahui_oleh)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [row.id, row.employee_id, tipe, 'Pelanggaran Teknis', row.alasan, row.tanggal_berlaku, berakhir, row.status, dik]);
        }
        await dbQuery.run("DROP TABLE IF EXISTS sanctions_old");
      } catch (e) {
        console.error("MIGRATION ERROR (Sanctions):", e.message);
      }
    }

    try {
      const info = await dbQuery.all("PRAGMA table_info(sanctions)");
      if (info.length > 0 && !info.some(c => c.name === 'tanggal_terbit')) {
        await dbQuery.run("ALTER TABLE sanctions ADD COLUMN tanggal_terbit TEXT");
        console.log("MIGRATION: Added tanggal_terbit column to sanctions table.");
        await dbQuery.run("UPDATE sanctions SET tanggal_terbit = tanggal_berlaku WHERE tanggal_terbit IS NULL");
      }
    } catch (e) {
      console.error("MIGRATION ERROR (sanctions.tanggal_terbit):", e.message);
    }



    // Migration for sops status_kirim
    try {
      const info = await dbQuery.all("PRAGMA table_info(sops)");
      if (info.length > 0 && !info.some(c => c.name === 'status_kirim')) {
        await dbQuery.run("ALTER TABLE sops ADD COLUMN status_kirim INTEGER DEFAULT 0");
        console.log("MIGRATION: Added status_kirim column to sops table.");
      }
    } catch (e) {
      console.error("MIGRATION ERROR (sops.status_kirim):", e.message);
    }

    // Migration for documentations
    try {
      const info = await dbQuery.all("PRAGMA table_info(documentations)");
      if (info.length > 0) {
        if (!info.some(c => c.name === 'status_kirim')) {
          await dbQuery.run("ALTER TABLE documentations ADD COLUMN status_kirim INTEGER DEFAULT 0");
          console.log("MIGRATION: Added status_kirim column to documentations table.");
        }
        if (!info.some(c => c.name === 'berlaku_di')) {
          await dbQuery.run("ALTER TABLE documentations ADD COLUMN berlaku_di TEXT");
          console.log("MIGRATION: Added berlaku_di column to documentations table.");
        }
        if (!info.some(c => c.name === 'jabatan_terkait')) {
          await dbQuery.run("ALTER TABLE documentations ADD COLUMN jabatan_terkait TEXT");
          console.log("MIGRATION: Added jabatan_terkait column to documentations table.");
        }
      }
    } catch (e) {
      console.error("MIGRATION ERROR (documentations):", e.message);
    }



    // === INDEKS PENDUKUNG PERFORMA ===
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_attendances_emp_date ON attendances(employee_id, date)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_leaves_emp ON leaves(employee_id)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_payrolls_emp_period ON payrolls(employee_id, period)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_revenues_outlet ON outlet_revenues(outlet_id)`);

    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_kpi_emp_period ON kpis(employee_id, periode)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_ratings_360_emp ON ratings_360(employee_id)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_sanctions_emp ON sanctions(employee_id)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_policies_kategori ON policies(kategori)`);
    await dbQuery.run(`CREATE INDEX IF NOT EXISTS idx_mobile_notif_emp ON mobile_user_notifications(employee_id)`);


    // Migration for contracts table to support new types & keterangan column
    let migrateContractsTable = false;
    try {
      const info = await dbQuery.all("PRAGMA table_info(contracts)");
      if (info.length > 0 && !info.some(c => c.name === 'keterangan')) {
        migrateContractsTable = true;
      }
    } catch (e) {}

    if (migrateContractsTable) {
      console.log("MIGRATION: Migrating contracts table to support new document types and keterangan...");
      try {
        await dbQuery.run("ALTER TABLE contracts RENAME TO contracts_old");
        await dbQuery.run(`
          CREATE TABLE contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomor_surat TEXT UNIQUE NOT NULL,
            employee_id INTEGER NOT NULL,
            jenis_kontrak TEXT CHECK(jenis_kontrak IN ('Surat Pengangkatan', 'Surat Perjanjian Kontrak', 'Surat Dinas', 'Surat Pemindahan Tugas', 'Surat Perintah')) NOT NULL,
            gaji_pokok REAL NOT NULL,
            uang_makan REAL NOT NULL,
            uang_lembur REAL NOT NULL,
            tunjangan_lama_bekerja REAL NOT NULL,
            tunjangan_keluarga REAL NOT NULL,
            tanggal_pembuatan TEXT NOT NULL,
            tanggal_selesai TEXT NOT NULL,
            status_persetujuan TEXT DEFAULT 'BELUM SIGN' CHECK(status_persetujuan IN ('BELUM SIGN', 'KONTRAK DITANDATANGANI')),
            keterangan TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
          )
        `);
        // Copy old data
        await dbQuery.run(`
          INSERT INTO contracts (
            id, nomor_surat, employee_id, jenis_kontrak, gaji_pokok, uang_makan, uang_lembur,
            tunjangan_lama_bekerja, tunjangan_keluarga, tanggal_pembuatan, tanggal_selesai, status_persetujuan, keterangan
          )
          SELECT id, nomor_surat, employee_id, jenis_kontrak, gaji_pokok, uang_makan, uang_lembur,
                 tunjangan_lama_bekerja, tunjangan_keluarga, tanggal_pembuatan, tanggal_selesai, status_persetujuan, NULL
          FROM contracts_old
        `);
        await dbQuery.run("DROP TABLE contracts_old");
        console.log("SUCCESS: Contracts table migration complete.");
      } catch (err) {
        console.error("CRITICAL: Failed to migrate contracts table:", err.message);
      }
    }

    console.log('SUCCESS: Semua tabel ekspansi database berhasil diinisialisasi.');

    // Migration for position_permissions to insert 'contracts' module if missing
    try {
      const contractPermExists = await dbQuery.get("SELECT id FROM position_permissions WHERE module = 'contracts' LIMIT 1");
      if (!contractPermExists) {
        console.log("MIGRATION: Seeding position_permissions for 'contracts' module...");
        await dbQuery.run("INSERT OR IGNORE INTO position_permissions (position, module, can_view, can_edit, can_delete) VALUES ('master', 'contracts', 1, 1, 1)");
        await dbQuery.run("INSERT OR IGNORE INTO position_permissions (position, module, can_view, can_edit, can_delete) VALUES ('admin', 'contracts', 1, 1, 1)");
        await dbQuery.run("INSERT OR IGNORE INTO position_permissions (position, module, can_view, can_edit, can_delete) VALUES ('leader', 'contracts', 1, 0, 0)");
        await dbQuery.run("INSERT OR IGNORE INTO position_permissions (position, module, can_view, can_edit, can_delete) VALUES ('user', 'contracts', 1, 0, 0)");
        console.log("SUCCESS: Seeding position_permissions for 'contracts' module complete.");
      }
    } catch (e) {
      console.error("Migration error seeding position_permissions for contracts:", e.message);
    }

    // === SEEDING HAK AKSES PERMISSION RBAC ===
    const rbacExists = await dbQuery.get("SELECT id FROM rbac_permissions LIMIT 1");
    if (!rbacExists) {
      const defaultPermissions = [
        // Owner Permissions
        { role: 'owner', key: 'manage_employees', allowed: 1 },
        { role: 'owner', key: 'view_attendance', allowed: 1 },
        { role: 'owner', key: 'manage_leaves', allowed: 1 },
        { role: 'owner', key: 'manage_payroll', allowed: 1 },
        { role: 'owner', key: 'manage_outlets', allowed: 1 },
        { role: 'owner', key: 'manage_rbac', allowed: 1 },
        { role: 'owner', key: 'manage_settings', allowed: 1 },
        // Admin Permissions
        { role: 'admin', key: 'manage_employees', allowed: 1 },
        { role: 'admin', key: 'view_attendance', allowed: 1 },
        { role: 'admin', key: 'manage_leaves', allowed: 1 },
        { role: 'admin', key: 'manage_payroll', allowed: 0 },
        { role: 'admin', key: 'manage_outlets', allowed: 1 },
        { role: 'admin', key: 'manage_rbac', allowed: 0 },
        { role: 'admin', key: 'manage_settings', allowed: 0 },
        // Employee Permissions
        { role: 'employee', key: 'manage_employees', allowed: 0 },
        { role: 'employee', key: 'view_attendance', allowed: 1 },
        { role: 'employee', key: 'manage_leaves', allowed: 0 },
        { role: 'employee', key: 'manage_payroll', allowed: 0 },
        { role: 'employee', key: 'manage_outlets', allowed: 0 },
        { role: 'employee', key: 'manage_rbac', allowed: 0 },
        { role: 'employee', key: 'manage_settings', allowed: 0 },
      ];

      for (const p of defaultPermissions) {
        await dbQuery.run(
          "INSERT OR IGNORE INTO rbac_permissions (role, permission_key, is_allowed) VALUES (?, ?, ?)",
          [p.role, p.key, p.allowed]
        );
      }
      console.log('SUCCESS: Seed data RBAC permissions berhasil dibuat.');
    }

    // === SEEDING PENGATURAN SYSTEM GLOBAL ===
    const settingsExists = await dbQuery.get("SELECT id FROM system_settings LIMIT 1");
    if (!settingsExists) {
      const defaultSettings = [
        { key: 'office_latitude', value: '-6.2088', desc: 'Koordinat lintang (Latitude) kantor utama' },
        { key: 'office_longitude', value: '106.8456', desc: 'Koordinat bujur (Longitude) kantor utama' },
        { key: 'geofence_radius_meters', value: '150', desc: 'Radius toleransi GPS absensi (meter)' },
        { key: 'clock_in_deadline', value: '08:00:00', desc: 'Jam batas absensi masuk tepat waktu' },
        { key: 'late_deduction_amount', value: '50000', desc: 'Denda pemotongan gaji per keterlambatan (Rp)' }
      ];

      for (const s of defaultSettings) {
        await dbQuery.run(
          "INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)",
          [s.key, s.value, s.desc]
        );
      }
      console.log('SUCCESS: Seed data system settings berhasil dibuat.');
    }

    // === SEEDING KREDENSIAL INTI (100% BAHASA INDONESIA) ===
    
    // Seed Owner
    const ownerExists = await dbQuery.get("SELECT id FROM users WHERE role = 'owner'");
    if (!ownerExists) {
      const defaultEmail = 'owner@hris.com';
      const defaultPassword = 'ownerpassword123';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(defaultPassword, salt);

      const userResult = await dbQuery.run(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
        [defaultEmail, passwordHash, 'owner']
      );

      await dbQuery.run(`
        INSERT INTO employees (user_id, nik, full_name, position, department, basic_salary, joined_date, outlet)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [userResult.id, 'NIK-OWNER', 'Direktur Utama', 'Chief Executive Officer', 'Manajemen', 100000000.0, '2026-05-29', 'AYAM BAKAR SURABAYA']);

      console.log('--------------------------------------------------');
      console.log('SEED DATA [Keamanan]: Akun Owner berhasil dibuat!');
      console.log(`Email    : ${defaultEmail}`);
      console.log(`Password : ${defaultPassword}`);
      console.log('--------------------------------------------------');
    }

    // Seed HR Admin
    const adminExists = await dbQuery.get("SELECT id FROM users WHERE role = 'admin'");
    const defaultAdminEmail = 'admin@hris.com';
    const defaultAdminPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultAdminPassword, salt);

    if (!adminExists) {
      const userResult = await dbQuery.run(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
        [defaultAdminEmail, passwordHash, 'admin']
      );

      await dbQuery.run(`
        INSERT INTO employees (user_id, nik, full_name, position, department, basic_salary, joined_date, outlet)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [userResult.id, 'NIK-ADMIN', 'Admin Personalia', 'Human Resources Manager', 'Departemen HR', 15000000.0, '2026-05-29', 'AYAM BAKAR SURABAYA']);

      console.log('--------------------------------------------------');
      console.log('SEED DATA [Keamanan]: Akun HR Admin berhasil dibuat!');
      console.log(`Email    : ${defaultAdminEmail}`);
      console.log(`Password : ${defaultAdminPassword}`);
      console.log('--------------------------------------------------');
    } else {
      // Pastikan password admin terupdate ke admin123
      await dbQuery.run(
        "UPDATE users SET password_hash = ? WHERE email = ?",
        [passwordHash, defaultAdminEmail]
      );
      console.log('--------------------------------------------------');
      console.log('SEED DATA [Keamanan]: Password Akun HR Admin diperbarui ke admin123!');
      console.log('--------------------------------------------------');
    }

    // Seed Default Outlets
    const outletExists = await dbQuery.get("SELECT id FROM outlets LIMIT 1");
    if (!outletExists) {
      await dbQuery.run(`
        INSERT INTO outlets (nama, wilayah, alamat, permodalan, status)
        VALUES 
        ('AYAM BAKAR SURABAYA', 'Jakarta Selatan', 'Jl. Barito No. 12, Kebayoran Baru', 'bootstrap', 'active'),
        ('AYAM PECAK 2001 SEAFOOD', 'Jakarta Barat', 'Jl. Pesanggrahan No. 88, Kembangan', 'investor', 'active'),
        ('PECEL LELE PAK HAJI', 'Jakarta Timur', 'Jl. Raden Inten No. 45, Duren Sawit', 'bootstrap', 'active')
      `);
      console.log('SEED DATA: Default outlets berhasil di-seed!');
    }

    // Seed Default Policies
    const checkAndSeedPolicy = async (nama, kategori, nilai, desc) => {
      const exists = await dbQuery.get("SELECT id FROM policies WHERE nama_kebijakan = ?", [nama]);
      if (!exists) {
        await dbQuery.run(
          "INSERT INTO policies (nama_kebijakan, kategori, nilai, keterangan, status) VALUES (?, ?, ?, ?, 'aktif')",
          [nama, kategori, nilai, desc]
        );
      }
    };

    const defaultPolicies = [
      {
        nama: 'JAM MASUK',
        kategori: 'jam_kerja',
        nilai: JSON.stringify({
          'AYAM BAKAR SURABAYA TT': '10:00',
          'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': '10:00',
          'AYAM PECAK 2001 SEAFOOD KISARAN': '10:00',
          'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': '10:00',
          'PECEL LELE PAK HAJI KISARAN': '10:00'
        }),
        desc: 'Kebijakan jam masuk kerja standar karyawan di setiap outlet.'
      },
      {
        nama: 'JAM PULANG',
        kategori: 'jam_kerja',
        nilai: JSON.stringify({
          'AYAM BAKAR SURABAYA TT': '22:30',
          'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': '00:30',
          'AYAM PECAK 2001 SEAFOOD KISARAN': '00:30',
          'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': '00:30',
          'PECEL LELE PAK HAJI KISARAN': '00:30'
        }),
        desc: 'Kebijakan jam pulang/selesai kerja karyawan di setiap outlet.'
      },
      {
        nama: 'JAM MULAI ISTIRAHAT',
        kategori: 'jam_kerja',
        nilai: JSON.stringify({
          'AYAM BAKAR SURABAYA TT': '15:00',
          'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': '15:00',
          'AYAM PECAK 2001 SEAFOOD KISARAN': '15:00',
          'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': '15:00',
          'PECEL LELE PAK HAJI KISARAN': '15:00'
        }),
        desc: 'Jam mulai waktu istirahat karyawan di setiap outlet.'
      },
      {
        nama: 'JAM AKHIR ISTIRAHAT',
        kategori: 'jam_kerja',
        nilai: JSON.stringify({
          'AYAM BAKAR SURABAYA TT': '17:00',
          'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': '18:00',
          'AYAM PECAK 2001 SEAFOOD KISARAN': '18:00',
          'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': '18:00',
          'PECEL LELE PAK HAJI KISARAN': '18:00'
        }),
        desc: 'Jam selesai waktu istirahat karyawan di setiap outlet.'
      }
    ];

    for (const p of defaultPolicies) {
      await checkAndSeedPolicy(p.nama, p.kategori, p.nilai, p.desc);
    }
    console.log('SEED DATA: Default policies checked & seeded successfully.');

    // === SEEDING HAK AKSES JABATAN (POSITION PERMISSIONS) ===
    const permExists = await dbQuery.get("SELECT id FROM position_permissions LIMIT 1");
    if (!permExists) {
      const roles = ['master', 'leader', 'admin', 'user'];
      const modules = [
        'employees', 'attendances', 'leaves', 'payroll', 'contracts', 'outlets',
        'revenues', 'sops', 'kpis', 'sanctions',
        'trainings', 'policies', 'settings'
      ];

      // Definisikan default perizinan
      const defaultRules = {
        master: {
          all: { can_view: 1, can_edit: 1, can_delete: 1 }
        },
        admin: {
          all: { can_view: 1, can_edit: 1, can_delete: 1 },
          settings: { can_view: 0, can_edit: 0, can_delete: 0 }
        },
        leader: {
          employees: { can_view: 1, can_edit: 0, can_delete: 0 },
          attendances: { can_view: 1, can_edit: 1, can_delete: 0 },
          leaves: { can_view: 1, can_edit: 1, can_delete: 0 },
          payroll: { can_view: 0, can_edit: 0, can_delete: 0 },
          contracts: { can_view: 1, can_edit: 0, can_delete: 0 },
          outlets: { can_view: 1, can_edit: 0, can_delete: 0 },
          revenues: { can_view: 1, can_edit: 1, can_delete: 0 },
          sops: { can_view: 1, can_edit: 0, can_delete: 0 },

          kpis: { can_view: 1, can_edit: 1, can_delete: 0 },
          sanctions: { can_view: 1, can_edit: 1, can_delete: 0 },
          trainings: { can_view: 1, can_edit: 0, can_delete: 0 },
          policies: { can_view: 1, can_edit: 0, can_delete: 0 },
          settings: { can_view: 0, can_edit: 0, can_delete: 0 }
        },
        user: {
          employees: { can_view: 0, can_edit: 0, can_delete: 0 },
          attendances: { can_view: 1, can_edit: 0, can_delete: 0 },
          leaves: { can_view: 1, can_edit: 1, can_delete: 0 },
          payroll: { can_view: 1, can_edit: 0, can_delete: 0 },
          contracts: { can_view: 1, can_edit: 0, can_delete: 0 },
          outlets: { can_view: 0, can_edit: 0, can_delete: 0 },
          revenues: { can_view: 0, can_edit: 0, can_delete: 0 },
          sops: { can_view: 1, can_edit: 0, can_delete: 0 },

          kpis: { can_view: 1, can_edit: 0, can_delete: 0 },
          sanctions: { can_view: 1, can_edit: 0, can_delete: 0 },
          trainings: { can_view: 0, can_edit: 0, can_delete: 0 },
          policies: { can_view: 1, can_edit: 0, can_delete: 0 },
          settings: { can_view: 0, can_edit: 0, can_delete: 0 }
        }
      };

      for (const role of roles) {
        for (const mod of modules) {
          let can_view = 0, can_edit = 0, can_delete = 0;
          
          if (defaultRules[role].all) {
            can_view = defaultRules[role].all.can_view;
            can_edit = defaultRules[role].all.can_edit;
            can_delete = defaultRules[role].all.can_delete;
          }
          
          if (defaultRules[role][mod] !== undefined) {
            can_view = defaultRules[role][mod].can_view;
            can_edit = defaultRules[role][mod].can_edit;
            can_delete = defaultRules[role][mod].can_delete;
          }

          await dbQuery.run(
            "INSERT INTO position_permissions (position, module, can_view, can_edit, can_delete) VALUES (?, ?, ?, ?, ?)",
            [role, mod, can_view, can_edit, can_delete]
          );
        }
      }
      console.log('SEED DATA: Default position permissions seeded successfully.');
    }






    // === RUN WAL CHECKPOINT AND VACUUM FOR DB OPTIMIZATION ===
    console.log('OPTIMIZATION: Running WAL checkpoint and VACUUM...');
    await dbQuery.run("PRAGMA wal_checkpoint(TRUNCATE)");
    await dbQuery.run("VACUUM");
    console.log('OPTIMIZATION: WAL checkpoint and VACUUM completed successfully.');

  } catch (error) {
    console.error('CRITICAL: Gagal menginisialisasi skema database:', error.message);
    process.exit(1);
  }
}

export default db;
