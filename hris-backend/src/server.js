import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initializeDatabase, dbQuery, transactionContext } from './config/db.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Rute API
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import pengajuanRoutes from './routes/pengajuanRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import rbacRoutes from './routes/rbacRoutes.js';
import outletRoutes from './routes/outletRoutes.js';
import sopRoutes from './routes/sopRoutes.js';
import kpiRoutes from './routes/kpiRoutes.js';
import sanctionRoutes from './routes/sanctionRoutes.js';
import trainingRoutes from './routes/trainingRoutes.js';
import policyRoutes from './routes/policyRoutes.js';
import docRoutes from './routes/docRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import informationRoutes from './routes/informationRoutes.js';
import surveyRoutes from './routes/surveyRoutes.js';
import { authenticateToken } from './middleware/auth.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. Konfigurasi Keamanan CORS (Cross-Origin Resource Sharing)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder']
}));

// 2. Body Parser
app.use(express.json({ limit: '10mb' })); // Limit upload untuk foto selfie absensi/izin

// 2b. Middleware Transaksi Database (AsyncLocalStorage)
app.use((req, res, next) => {
  const store = new Map();
  transactionContext.run(store, () => {
    // Fungsi pembersihan koneksi transaksi otomatis jika belum di-commit/rollback
    const cleanup = () => {
      const conn = store.get('connection');
      if (conn) {
        conn.rollback()
          .catch(err => console.error('[Auto-Rollback] Error:', err.message))
          .finally(() => {
            conn.release();
            store.delete('connection');
          });
      }
    };
    res.on('finish', cleanup);
    res.on('close', cleanup);
    next();
  });
});

// 3. Middleware Header Keamanan HTTP Kustom (Security Hardening)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none';");
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  next();
});

// 4. Inisialisasi Database SQLite
initializeDatabase().then(() => {
  console.log('Database initialized successfully.');
}).catch((err) => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});

// 5. Registrasi Rute API
app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Selamat datang di API HRIS Sistem (Web Portal & Android Backend).'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/pengajuan', pengajuanRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/sops', sopRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/sanctions', sanctionRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/documentations', docRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/informations', informationRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/uploads', express.static(path.resolve('uploads')));

// File-based database for training materials and DISC results
import fs from 'fs';

const BACKEND_DB_FILE = path.resolve('backend_sync_db.json');
let backendState = {
  training_materials: [],
  disc_results: [],
  credentials: [],
  payroll_mobile_slips: [],
  quiz_bank: [],
  quiz_results: []
};

if (fs.existsSync(BACKEND_DB_FILE)) {
  try {
    backendState = JSON.parse(fs.readFileSync(BACKEND_DB_FILE, 'utf-8'));
    console.log('Loaded backendState from backend_sync_db.json');
  } catch (err) {
    console.error('Error reading backend_sync_db.json, using defaults:', err.message);
  }
}
backendState.credentials = backendState.credentials || [];
backendState.payroll_mobile_slips = backendState.payroll_mobile_slips || [];
backendState.quiz_bank = backendState.quiz_bank || [];
backendState.quiz_results = backendState.quiz_results || [];

const hrisDatabase = backendState;

function saveBackendDb() {
  try {
    fs.writeFileSync(BACKEND_DB_FILE, JSON.stringify(backendState, null, 2), 'utf-8');
  } catch (err) {}
}

// Mobile slips endpoints MUST be defined before /api/payroll router mount to bypass its global authentication middleware
app.get('/api/payroll/mobile-slips', authenticateToken, (req, res) => {
  const empId = String(req.user.employeeId);
  const slips = (backendState.payroll_mobile_slips || []).filter(
    s => String(s.employee_id) === empId
  );
  res.json({ status: 'success', data: slips });
});

app.post('/api/payroll/mobile-slips', async (req, res) => {
  const newSlips = req.body.slips || [];
  
  // Deteksi slip baru untuk mengirimkan notifikasi mobile
  const existingSlips = backendState.payroll_mobile_slips || [];
  const existingKeys = new Set(existingSlips.map(s => `${s.employee_id}-${s.bulan}-${s.tahun}`));
  
  for (const slip of newSlips) {
    const key = `${slip.employee_id}-${slip.bulan}-${slip.tahun}`;
    if (!existingKeys.has(key)) {
      // Slip baru! Tembak notifikasi ke SQLite mobile_user_notifications
      try {
        const empId = Number(slip.employee_id);
        const emp = await dbQuery.get("SELECT outlet FROM employees WHERE id = ?", [empId]);
        const outlet = emp ? emp.outlet : (slip.outlet || 'AYAM BAKAR SURABAYA');
        
        await dbQuery.run(
          `INSERT INTO mobile_user_notifications (employee_id, outlet, title, message, type, is_read) 
           VALUES (?, ?, ?, ?, 'payroll', 0)`,
          [empId, outlet, 'Slip Gaji Baru Terbit', `Slip Gaji untuk periode ${slip.bulan}/${slip.tahun} telah dikirim ke HP Anda.`]
        );
        console.log(`[Notification] Created payroll notification for employee ID ${empId}`);
      } catch (err) {
        console.error('[Notification] Failed to create payroll notification:', err.message);
      }
    }
  }

  backendState.payroll_mobile_slips = newSlips;
  saveBackendDb();
  res.json({ status: 'success' });
});

app.use('/api/payroll', payrollRoutes);

app.get('/api/mobile/public-users', async (req, res) => {
  try {
    const list = await dbQuery.all(`
      SELECT e.id, e.full_name, e.position, e.outlet, u.email as username
      FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE u.role = 'employee'
    `);
    
    const passwords = (backendState.user_credentials && backendState.user_credentials.passwords) || {};
    
    const formatted = list.map(emp => {
      const pass = passwords[emp.id] || '123456';
      return {
        id: emp.id,
        full_name: emp.full_name,
        position: emp.position,
        outlet: emp.outlet,
        username: emp.username,
        password: pass
      };
    });
    
    res.json({ status: 'success', data: formatted });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/training-media', (req, res) => {
  res.json({ status: 'success', materials: backendState.training_materials });
});

app.post('/api/training-media', (req, res) => {
  backendState.training_materials = req.body.materials || [];
  saveBackendDb();
  res.json({ status: 'success' });
});

app.get('/api/disc-results', (req, res) => {
  res.json({ status: 'success', results: backendState.disc_results });
});

app.post('/api/disc-results', (req, res) => {
  const result = req.body;
  result.id = `DISC-${Date.now()}`;
  result.created_at = new Date().toISOString();
  backendState.disc_results.push(result);
  saveBackendDb();
  res.json({ status: 'success', data: result });
});

// Endpoint menerima akun baru dari Web Admin
app.post('/api/credentials/sync', async (req, res) => {
  const { username, password, employeeName, outlet, role, id, employeeId } = req.body;
  const accountExists = hrisDatabase.credentials.some(user => user.username === username);
  if (!accountExists) {
    hrisDatabase.credentials.push({ username, password, employeeName, outlet, role, id: Number(id), employeeId: Number(employeeId) });
  } else {
    const idx = hrisDatabase.credentials.findIndex(user => user.username === username);
    hrisDatabase.credentials[idx] = { username, password, employeeName, outlet, role, id: Number(id), employeeId: Number(employeeId) };
  }

  // Jembatani ke user_credentials agar Web Login di authController juga tersinkronisasi instan!
  if (!hrisDatabase.user_credentials) {
    hrisDatabase.user_credentials = { passwords: {}, usernames: {}, roles: {} };
  }
  if (!hrisDatabase.user_credentials.passwords) hrisDatabase.user_credentials.passwords = {};
  if (!hrisDatabase.user_credentials.usernames) hrisDatabase.user_credentials.usernames = {};
  if (!hrisDatabase.user_credentials.roles) hrisDatabase.user_credentials.roles = {};

  hrisDatabase.user_credentials.passwords[id] = password;
  hrisDatabase.user_credentials.usernames[id] = username;
  hrisDatabase.user_credentials.roles[id] = role;

  saveBackendDb();

  // Tambahkan sinkronisasi instan ke database SQLite users table!
  try {
    const employee = await dbQuery.get("SELECT user_id FROM employees WHERE id = ?", [id]);
    if (employee && employee.user_id) {
      let mappedRole = 'employee';
      const roleLower = role.toLowerCase();
      if (roleLower === 'owner' || roleLower === 'master') {
        mappedRole = 'owner';
      } else if (roleLower === 'admin' || roleLower === 'leader') {
        mappedRole = 'admin';
      }
      
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      await dbQuery.run(
        "UPDATE users SET email = ?, password_hash = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [username.toLowerCase().trim(), passwordHash, mappedRole, employee.user_id]
      );
      console.log(`[Instant Sync] SQLite users table updated for employee ID ${id} (user_id ${employee.user_id})`);
    }
  } catch (dbErr) {
    console.error('[Instant Sync] Failed to update SQLite users table:', dbErr.message);
  }

  res.status(200).json({ success: true, message: "Kredensial Sinkron ke Server Pusat" });
});


// Endpoint mengambil daftar seluruh kredensial aktif
app.get('/api/credentials', async (req, res) => {
  try {
    const list = hrisDatabase.credentials || [];
    res.json({ status: 'success', data: list });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Endpoint menghapus akun kredensial dan mereset ke default login NIK
app.delete('/api/credentials/:id', async (req, res) => {
  const { id } = req.params; // id adalah employeeId
  try {
    // Hapus dari daftar credentials
    hrisDatabase.credentials = (hrisDatabase.credentials || []).filter(c => Number(c.id) !== Number(id));
    
    // Hapus dari user_credentials dictionary
    if (hrisDatabase.user_credentials) {
      if (hrisDatabase.user_credentials.passwords) delete hrisDatabase.user_credentials.passwords[id];
      if (hrisDatabase.user_credentials.usernames) delete hrisDatabase.user_credentials.usernames[id];
      if (hrisDatabase.user_credentials.roles) delete hrisDatabase.user_credentials.roles[id];
    }
    
    saveBackendDb();

    // Reset status di database MySQL users table ke default login berbasis NIK
    const employee = await dbQuery.get("SELECT user_id, nik FROM employees WHERE id = ?", [id]);
    if (employee && employee.user_id) {
      const defaultEmail = `${employee.nik.toLowerCase()}@hris.local`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(employee.nik || '123456', salt);
      
      await dbQuery.run(
        "UPDATE users SET email = ?, password_hash = ?, role = 'employee', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [defaultEmail, passwordHash, employee.user_id]
      );
      console.log(`[Instant Sync Delete] MySQL users table reset for employee ID ${id} (user_id ${employee.user_id})`);
    }
    
    res.status(200).json({ success: true, message: "Kredensial Dihapus & Reset ke Default" });
  } catch (err) {
    console.error('[Instant Sync Delete] Failed to reset credentials:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


// --- ENDPOINTS BARU SINKRONISASI SLIP GAJI, KUIS & NOTIFIKASI ---

// 2. Endpoint Kuis Kompetensi
app.get('/api/quizzes', authenticateToken, (req, res) => {
  const quizzes = backendState.quiz_bank || [];
  
  if (req.user.role === 'employee') {
    // Karyawan hanya bisa melihat kuis yang sudah terkirim/aktif dan sesuai target jabatan
    const filtered = quizzes.filter(q => {
      const matchStatus = q.status === 'terkirim';
      const myPos = (req.user.position || '').toUpperCase().trim();
      const targetPos = (q.divisi || 'Semua').toUpperCase().trim();
      const matchDivisi = targetPos === 'SEMUA' || myPos === targetPos || myPos.includes(targetPos) || targetPos.includes(myPos);
      return matchStatus && matchDivisi;
    }).map(q => {
      // Map ke format yang diharapkan oleh mobile app (QuizRecord)
      return {
        id: Number(q.id),
        judul: q.nama_kuis,
        deskripsi: q.deskripsi || 'Silakan kerjakan kuis evaluasi kompetensi ini.',
        skor_kelulusan: 80.0,
        outlet_target: q.outlet || 'Semua Outlet',
        jabatan_target: q.divisi || 'Semua Jabatan',
        jenis_kuis: q.nama_kuis.toLowerCase().includes('matriks') ? 'Matriks Pilihan' : 'Pilihan Berganda',
        durasi_menit: Number(q.durasi_menit || 15),
        tanggal_mulai: q.periode_aktif_start,
        tanggal_akhir: q.periode_aktif_end,
        soal: (q.soal || []).map(s => ({
          nomor: Number(s.no || s.nomor || 1),
          tanya: s.soal || s.tanya || '',
          opsi_a: s.pilihan ? (s.pilihan.A || s.pilihan.a || '') : (s.opsi_a || ''),
          opsi_b: s.pilihan ? (s.pilihan.B || s.pilihan.b || '') : (s.opsi_b || ''),
          opsi_c: s.pilihan ? (s.pilihan.C || s.pilihan.c || '') : (s.opsi_c || ''),
          opsi_d: s.pilihan ? (s.pilihan.D || s.pilihan.d || '') : (s.opsi_d || ''),
          kunci: s.kunci || 'A'
        })),
        status_kirim: q.status === 'terkirim' ? 1 : 0
      };
    });
    
    return res.json({ status: 'success', data: filtered });
  }
  
  // Owner/Admin: Kembalikan semua kuis utuh
  res.json({ status: 'success', data: quizzes });
});

app.post('/api/quizzes', async (req, res) => {
  const newQuizzes = req.body.quizzes || [];
  
  // Deteksi kuis baru yang dikirim untuk mengirimkan notifikasi mobile
  const existingQuizzes = backendState.quiz_bank || [];
  const existingSentIds = new Set(existingQuizzes.filter(q => q.status === 'terkirim').map(q => String(q.id)));
  
  for (const quiz of newQuizzes) {
    if (quiz.status === 'terkirim' && !existingSentIds.has(String(quiz.id))) {
      // Kuis baru dikirim! Masukkan notifikasi ke SQLite
      try {
        const targetEmployees = await dbQuery.all("SELECT id, full_name, position, outlet FROM employees WHERE status = 'active'");
        for (const emp of targetEmployees) {
          const myPos = (emp.position || '').toUpperCase().trim();
          const targetPos = (quiz.divisi || 'Semua').toUpperCase().trim();
          const matchDivisi = targetPos === 'SEMUA' || myPos === targetPos || myPos.includes(targetPos) || targetPos.includes(myPos);
          
          if (matchDivisi) {
            await dbQuery.run(
              `INSERT INTO mobile_user_notifications (employee_id, outlet, title, message, type, is_read) 
               VALUES (?, ?, ?, ?, 'quiz', 0)`,
              [emp.id, emp.outlet, 'Kuis Kompetensi Baru', `Kuis "${quiz.nama_kuis}" telah dikirim. Silakan kerjakan!`]
            );
            console.log(`[Notification] Created quiz notification for employee ID ${emp.id}`);
          }
        }
      } catch (err) {
        console.error('[Notification] Failed to create quiz notifications:', err.message);
      }
    }
  }

  backendState.quiz_bank = newQuizzes;
  saveBackendDb();
  res.json({ status: 'success' });
});

// 3. Endpoint Hasil Kuis / Pengerjaan Kuis
app.get('/api/quizzes/attempts', authenticateToken, (req, res) => {
  const results = backendState.quiz_results || [];
  
  if (req.user.role === 'employee') {
    // Filter attempts for the employee
    const filtered = results.filter(
      r => Number(r.employee_id) === Number(req.user.employeeId)
    ).map(r => ({
      id: isNaN(Number(r.id)) ? 1 : Number(r.id),
      employee_id: Number(r.employee_id),
      quiz_id: Number(r.quiz_id),
      nilai: Number(r.skor || r.nilai || 0),
      status: r.status_lulus === true || r.status === 'lulus' ? 'lulus' : 'tidak lulus',
      tanggal: r.tanggal_selesai || r.tanggal || new Date().toISOString()
    }));
    
    return res.json({ status: 'success', data: filtered });
  }
  
  // Owner/Admin: Kembalikan semua hasil
  res.json({ status: 'success', data: results });
});

app.post('/api/quizzes/attempts', authenticateToken, async (req, res) => {
  // Jika sync dari web admin
  if (req.body.attempts) {
    backendState.quiz_results = req.body.attempts;
    saveBackendDb();
    return res.json({ status: 'success' });
  }
  
  // Submit pengerjaan dari aplikasi mobile
  const { quiz_id, jawaban } = req.body;
  if (!quiz_id || !jawaban) {
    return res.status(400).json({ status: 'error', message: 'Parameter quiz_id dan jawaban wajib disertakan.' });
  }
  
  try {
    // Cari kuis di bank soal
    const quiz = (backendState.quiz_bank || []).find(q => Number(q.id) === Number(quiz_id));
    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Kuis tidak ditemukan di server.' });
    }
    
    const questions = quiz.soal || [];
    let correct = 0;
    
    // Hitung jawaban benar
    questions.forEach((s, idx) => {
      const userAns = String(jawaban[idx] || '').trim().toUpperCase();
      const correctAnswer = String(s.kunci || '').trim().toUpperCase();
      if (userAns === correctAnswer) {
        correct++;
      }
    });
    
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const isLulus = score >= 80; // standar kelulusan
    
    const employee = await dbQuery.get("SELECT id, full_name, outlet FROM employees WHERE id = ?", [req.user.employeeId]);
    const empName = employee ? employee.full_name : 'Karyawan';
    const empOutlet = employee ? employee.outlet : 'Semua Outlet';
    
    const newResult = {
      id: Date.now().toString(),
      quiz_id: Number(quiz_id),
      employee_id: req.user.employeeId,
      employee_name: empName,
      outlet: empOutlet,
      skor: score,
      status_lulus: isLulus,
      tanggal_selesai: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      jawaban: JSON.stringify(jawaban)
    };
    
    const existing = (backendState.quiz_results || []).filter(
      r => !(Number(r.quiz_id) === Number(quiz_id) && Number(r.employee_id) === Number(req.user.employeeId))
    );
    backendState.quiz_results = [...existing, newResult];
    saveBackendDb();
    
    // Tandai notifikasi kuis terkait sebagai dibaca di SQLite
    await dbQuery.run(
      "UPDATE mobile_user_notifications SET is_read = 1 WHERE employee_id = ? AND type = 'quiz'",
      [req.user.employeeId]
    );
    
    res.status(201).json({ status: 'success', data: newResult });
  } catch (err) {
    console.error('Submit Quiz Attempt error:', err.message);
    res.status(500).json({ status: 'error', message: 'Gagal memproses pengerjaan kuis.' });
  }
});


// Endpoint Dispatcher Pemutus Macet Koneksi
app.post('/api/v1/dispatch-event', async (req, res) => {
  const { type, targetOutlet, targetJabatan, messageTitle, content } = req.body;
  
  // Logika Inisiatif Mandiri: Masukkan ke antrean database pusat
  const newNotification = {
    id: 'NOTIF-' + Date.now(),
    type: type || 'broadcast',
    targetOutlet: targetOutlet || 'Semua Outlet',
    targetJabatan: targetJabatan || 'Semua Jabatan',
    messageTitle: messageTitle || 'Notifikasi Baru',
    content: content || '',
    timestamp: new Date().toISOString(),
    readBy: [] // Untuk melacak Read Receipt di HP karyawan
  };
  
  if (!backendState.broadcasts) {
    backendState.broadcasts = [];
  }
  backendState.broadcasts.push(newNotification);
  saveBackendDb();

  // Kirim sinyal balik sukses ke Web Admin
  // Tulis ke tabel mobile_user_notifications di SQLite secara paralel
  try {
    const outletFilter = (!targetOutlet || targetOutlet === 'Semua Outlet') ? '%' : targetOutlet.trim();
    const positionFilter = (!targetJabatan || targetJabatan === 'Semua Jabatan') ? '%' : targetJabatan.trim();
    
    const employees = await dbQuery.all(
      `SELECT id, outlet, position FROM employees 
       WHERE (outlet LIKE ? OR ? = '%') 
       AND (position LIKE ? OR ? = '%')
       AND status = 'active'`,
      [outletFilter, outletFilter, positionFilter, positionFilter]
    );

    for (const emp of employees) {
      await dbQuery.run(
        `INSERT INTO mobile_user_notifications (employee_id, outlet, title, message, type, is_read) 
         VALUES (?, ?, ?, ?, ?, 0)`,
        [emp.id, emp.outlet, messageTitle || 'Notifikasi Baru', content || '', type || 'broadcast']
      );
      console.log(`[Notification Dispatcher] Created notification for employee ID ${emp.id}`);
    }
  } catch (err) {
    console.error('[Notification Dispatcher] Error database writing:', err.message);
  }

  res.status(200).json({ success: true, message: "Sinyal Event Terdistribusi ke Perangkat Lapangan" });
});


// Serve static files from frontend build
app.use(express.static(path.resolve(__dirname, '../../hris-web/dist')));

// Wildcard routing using RegExp to support SPA (React Router) on non-API routes
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../hris-web/dist/index.html'));
});


// 6. Global Error-Handling Middleware (Anti Information-Leakage)
app.use((err, req, res, next) => {
  console.error('Unhandled System Error:', err.stack);
  
  // Jangan membocorkan error teknis internal database/sistem ke pengguna akhir
  return res.status(500).json({
    status: 'error',
    message: 'Terjadi kesalahan internal pada server kami.'
  });
});

// 7. Jalankan Server pada 0.0.0.0 demi kemudahan pengujian perangkat seluler
const serverPort = config.port;
app.listen(serverPort, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(`HRIS Backend Server is running successfully.`);
  console.log(`Address : http://0.0.0.0:${serverPort}`);
  console.log(`Time    : ${new Date().toLocaleString()}`);
  console.log('==================================================');
});

export default app;
