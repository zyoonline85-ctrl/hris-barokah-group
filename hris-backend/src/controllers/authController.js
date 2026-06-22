import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { dbQuery } from '../config/db.js';
import { config } from '../config/env.js';
import { mapPositionToRole } from '../middleware/permissionMiddleware.js';

/**
 * Sync Credentials to JSON DB file
 */
export async function syncCredentials(req, res) {
  const { passwords, usernames, roles } = req.body;
  try {
    const dbPath = path.resolve('backend_sync_db.json');
    let state = { training_materials: [], disc_results: [], credentials: [] };
    if (fs.existsSync(dbPath)) {
      state = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
    state.user_credentials = {
      passwords: passwords || {},
      usernames: usernames || {},
      roles: roles || {}
    };

    // Reconstruct credentials list for mobile to ensure consistency
    state.credentials = [];
    const activeUsernames = usernames || {};
    const activePasswords = passwords || {};
    const activeRoles = roles || {};

    for (const [empId, username] of Object.entries(activeUsernames)) {
      const password = activePasswords[empId];
      if (!password) continue;
      
      const role = activeRoles[empId] || 'Karyawan';
      
      // Query database for name and outlet
      let employeeName = 'Karyawan HRIS';
      let outlet = 'PUSAT';
      try {
        const employee = await dbQuery.get("SELECT full_name, outlet FROM employees WHERE id = ?", [empId]);
        if (employee) {
          employeeName = employee.full_name;
          outlet = employee.outlet || 'PUSAT';
        }
      } catch (err) {
        console.error('Error querying employee details for sync:', err);
      }

      state.credentials.push({
        username,
        password,
        employeeName,
        outlet,
        role,
        id: Number(empId),
        employeeId: Number(empId)
      });
    }

    fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), 'utf-8');

    // Tambahkan sinkronisasi massal / penyelarasan ke database SQLite users table!
    try {
      const allEmployees = await dbQuery.all("SELECT id, user_id, nik FROM employees");
      for (const emp of allEmployees) {
        const empIdStr = String(emp.id);
        if (activeUsernames[empIdStr] && activePasswords[empIdStr]) {
          const username = activeUsernames[empIdStr];
          const password = activePasswords[empIdStr];
          const role = activeRoles[empIdStr] || 'Karyawan';
          
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
            [username.toLowerCase().trim(), passwordHash, mappedRole, emp.user_id]
          );
        } else {
          // Lindungi seed owner (user_id 1) dan seed admin (user_id 2) agar tidak direset ke employee
          if (emp.user_id === 1 || emp.user_id === 2) {
            continue;
          }
          // Reset ke default login berbasis NIK
          const defaultEmail = `${emp.nik.toLowerCase()}@hris.local`;
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(emp.nik || '123456', salt);
          
          await dbQuery.run(
            "UPDATE users SET email = ?, password_hash = ?, role = 'employee', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [defaultEmail, passwordHash, emp.user_id]
          );
        }
      }
      console.log(`[Bulk Sync] SQLite users table synchronized for all ${allEmployees.length} employees.`);
    } catch (dbErr) {
      console.error('[Bulk Sync] Failed to synchronize SQLite users table:', dbErr.message);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Credentials synchronized successfully.'
    });
  } catch (error) {
    console.error('syncCredentials error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to sync credentials.'
    });
  }
}

/**
 * Login Pengguna
 */
export async function login(req, res) {
  const { email, password, client } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Email dan password harus diisi.'
    });
  }

  const searchUser = email.toLowerCase().trim();

  try {
    // 1. Cek laci penyimpanan akun custom-synced terlebih dahulu (backend_sync_db.json)
    let syncedPass = {};
    let syncedUsernames = {};
    let syncedRoles = {};
    
    try {
      const dbPath = path.resolve('backend_sync_db.json');
      if (fs.existsSync(dbPath)) {
        const state = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        if (state.user_credentials) {
          syncedPass = state.user_credentials.passwords || {};
          syncedUsernames = state.user_credentials.usernames || {};
          syncedRoles = state.user_credentials.roles || {};
        }
      }
    } catch (err) {
      console.error('Error reading backend db in login:', err);
    }

    let foundEmpId = null;
    for (const [empId, username] of Object.entries(syncedUsernames)) {
      if (String(username).toLowerCase().trim() === searchUser) {
        foundEmpId = empId;
        break;
      }
    }

    if (foundEmpId) {
      const savedPass = syncedPass[foundEmpId];
      if (savedPass && String(savedPass) === String(password)) {
        // Password Cocok! Ambil data profil karyawan dari SQLite (perbaikan query id saja)
        const employee = await dbQuery.get("SELECT id, user_id, full_name, position, outlet FROM employees WHERE id = ?", [foundEmpId]);
        const userRole = (syncedRoles[foundEmpId] || (employee ? mapPositionToRole(employee.position) : 'karyawan')).toLowerCase();

        // Guard Access: Web client hanya diperuntukkan bagi Master, Owner, Admin, Leader
        const isClientWeb = client === 'web';
        const isWebAllowed = userRole === 'master' || userRole === 'owner' || userRole === 'admin' || userRole === 'leader';
        if (isClientWeb && !isWebAllowed) {
          return res.status(403).json({
            status: 'error',
            message: 'Akses Ditolak: Akun Karyawan biasa hanya diperbolehkan masuk melalui Aplikasi Mobile Android.'
          });
        }

        // Gunakan employee.user_id jika ada agar selaras dengan tabel users dan middleware authenticateToken
        const tokenUserId = employee ? employee.user_id : foundEmpId;

        // Sign JWT Token
        const token = jwt.sign(
          { userId: tokenUserId, email: searchUser, role: userRole },
          config.jwtSecret,
          { expiresIn: '24h' }
        );

        return res.status(200).json({
          status: 'success',
          message: 'Login berhasil',
          data: {
            token,
            user: {
              id: tokenUserId,
              email: searchUser,
              role: userRole,
              employeeId: employee ? employee.id : foundEmpId,
              fullName: employee ? employee.full_name : 'Karyawan HRIS',
              outlet: employee ? employee.outlet : null,
              position: employee ? employee.position : 'Karyawan'
            }
          }
        });
      } else {
        return res.status(401).json({
          status: 'error',
          message: 'Email atau password yang Anda masukkan salah.'
        });
      }
    }

    // 2. Jika tidak ditemukan di custom-synced, cari user di database SQLite standard
    const user = await dbQuery.get("SELECT * FROM users WHERE email = ?", [searchUser]);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Email atau password yang Anda masukkan salah.'
      });
    }

    // Verifikasi password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Email atau password yang Anda masukkan salah.'
      });
    }

    const userRole = user.role.toLowerCase();
    // Guard Access: Web client hanya diperuntukkan bagi Master, Owner, Admin, Leader
    const isClientWeb = client === 'web';
    const isWebAllowed = userRole === 'master' || userRole === 'owner' || userRole === 'admin' || userRole === 'leader';
    if (isClientWeb && !isWebAllowed) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses Ditolak: Akun Karyawan biasa hanya diperbolehkan masuk melalui Aplikasi Mobile Android.'
      });
    }

    // Ambil profil karyawan terkait
    const employee = await dbQuery.get("SELECT id, full_name, position, outlet FROM employees WHERE user_id = ?", [user.id]);

    // Sign JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employeeId: employee ? employee.id : null,
          fullName: employee ? employee.full_name : 'Admin System',
          outlet: employee ? employee.outlet : null,
          position: employee ? employee.position : null
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan sistem saat memproses login.'
    });
  }
}

/**
 * Mendapatkan data profil user aktif
 */
export async function getMe(req, res) {
  try {
    const user = await dbQuery.get(
      `SELECT u.id, u.email, u.role, e.id as employee_id, e.nik, e.full_name, e.position, e.department, e.basic_salary, e.joined_date, e.outlet
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('GetMe error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan sistem saat mengambil profil.'
    });
  }
}

/**
 * Mendapatkan daftar hak akses modul dari user aktif
 */
export async function getMyPermissions(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Membutuhkan autentikasi.'
      });
    }

    const modules = [
      'employees', 'attendances', 'leaves', 'payroll', 'outlets',
      'revenues', 'sops', 'contracts', 'kpis', 'sanctions',
      'trainings', 'policies', 'settings'
    ];

    let permissions = {};

    if (req.user.role === 'owner') {
      // Owner memiliki hak akses penuh (bypass) untuk seluruh modul
      for (const mod of modules) {
        permissions[mod] = { can_view: 1, can_edit: 1, can_delete: 1 };
      }
    } else {
      const role = mapPositionToRole(req.user.position);
      const rows = await dbQuery.all(
        "SELECT module, can_view, can_edit, can_delete FROM position_permissions WHERE position = ?",
        [role]
      );
      
      // Inisialisasi default 0 untuk semua modul
      for (const mod of modules) {
        permissions[mod] = { can_view: 0, can_edit: 0, can_delete: 0 };
      }

      for (const row of rows) {
        if (modules.includes(row.module)) {
          permissions[row.module] = {
            can_view: row.can_view,
            can_edit: row.can_edit,
            can_delete: row.can_delete
          };
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        permissions
      }
    });
  } catch (error) {
    console.error('getMyPermissions error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan sistem saat mengambil hak akses.'
    });
  }
}
