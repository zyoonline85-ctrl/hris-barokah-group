import bcrypt from 'bcryptjs';
import { dbQuery } from '../config/db.js';
import { mapPositionToRole } from '../middleware/permissionMiddleware.js';

/**
 * Mendapatkan semua daftar karyawan aktif (Khusus Owner/Admin)
 */
export async function getAllEmployees(req, res) {
  try {
    const employees = await dbQuery.all(`
      SELECT e.id, e.nik, e.full_name, e.position, e.department, e.basic_salary, e.status, e.joined_date, e.outlet, e.gender, u.email
      FROM employees e
      JOIN users u ON e.user_id = u.id
      ORDER BY e.id DESC
    `);

    return res.status(200).json({
      status: 'success',
      data: employees
    });
  } catch (error) {
    console.error('GetAllEmployees error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil daftar karyawan dari database.'
    });
  }
}

/**
 * Mendapatkan detail satu karyawan berdasarkan ID
 */
export async function getEmployeeById(req, res) {
  const { id } = req.params;

  try {
    const employee = await dbQuery.get(`
      SELECT e.id, e.nik, e.full_name, e.phone, e.address, e.position, e.department, e.basic_salary, e.status, e.joined_date, e.outlet, e.gender, u.email
      FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = ?
    `, [id]);

    if (!employee) {
      return res.status(404).json({
        status: 'error',
        message: 'Karyawan tidak ditemukan.'
      });
    }

    // Pastikan karyawan hanya bisa melihat profil mereka sendiri, kecuali jika pengakses memiliki izin view employees
    const isSelf = req.user.employeeId === parseInt(id, 10);
    let isAllowed = req.user.role === 'owner';
    if (!isSelf && !isAllowed) {
      const role = mapPositionToRole(req.user.position);
      const perm = await dbQuery.get("SELECT can_view FROM position_permissions WHERE position = ? AND module = ?", [role, 'employees']);
      if (perm && perm.can_view === 1) {
        isAllowed = true;
      }
    }
    if (!isSelf && !isAllowed) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Anda tidak diizinkan melihat profil karyawan lain.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: employee
    });
  } catch (error) {
    console.error('GetEmployeeById error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil detail data karyawan.'
    });
  }
}

export async function createEmployee(req, res) {
  const { email, password, nik, full_name, phone, address, position, department, basic_salary, joined_date, role, outlet, gender } = req.body;

  // Validasi input wajib
  if (!email || !password || !nik || !full_name || !position || !department || basic_salary === undefined || !joined_date) {
    return res.status(400).json({
      status: 'error',
      message: 'Kolom email, password, NIK, nama lengkap, jabatan, divisi, gaji pokok, dan tanggal masuk wajib diisi.'
    });
  }

  try {
    // 1. Periksa apakah email sudah terdaftar
    const emailExists = await dbQuery.get("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    if (emailExists) {
      return res.status(400).json({
        status: 'error',
        message: 'Email sudah terdaftar dalam sistem.'
      });
    }

    // 2. Periksa apakah NIK sudah terdaftar
    const nikExists = await dbQuery.get("SELECT id FROM employees WHERE nik = ?", [nik.trim()]);
    if (nikExists) {
      return res.status(400).json({
        status: 'error',
        message: 'Nomor Induk Karyawan (NIK) sudah digunakan.'
      });
    }

    // 3. Hash Password akun karyawan baru
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Masukkan akun ke tabel users (role custom: 'admin' atau 'employee')
    const userRole = (role === 'admin') ? 'admin' : 'employee';
    const userResult = await dbQuery.run(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email.toLowerCase().trim(), passwordHash, userRole]
    );

    // 5. Masukkan profil ke tabel employees
    const empResult = await dbQuery.run(`
      INSERT INTO employees (user_id, nik, full_name, phone, address, position, department, basic_salary, joined_date, outlet, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userResult.id,
      nik.trim(),
      full_name.trim(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      position.trim(),
      department.trim(),
      parseFloat(basic_salary),
      joined_date,
      outlet ? outlet.trim() : null,
      gender ? gender.trim() : 'Pria'
    ]);

    return res.status(201).json({
      status: 'success',
      message: 'Karyawan baru dan akun login berhasil ditambahkan.',
      data: {
        employeeId: empResult.id,
        nik
      }
    });

  } catch (error) {
    console.error('CreateEmployee error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menambahkan karyawan baru ke dalam sistem.'
    });
  }
}

/**
 * Memperbarui Data Profil Karyawan (Owner/Admin atau Karyawan Bersangkutan)
 */
export async function updateEmployee(req, res) {
  const { id } = req.params;
  const { full_name, phone, address, position, department, basic_salary, status, joined_date, outlet, gender } = req.body;

  try {
    // 1. Cari karyawan
    const employee = await dbQuery.get("SELECT * FROM employees WHERE id = ?", [id]);
    if (!employee) {
      return res.status(404).json({
        status: 'error',
        message: 'Karyawan tidak ditemukan.'
      });
    }

    // 2. Proteksi hak akses: Karyawan sendiri bisa edit terbatas, pengakses dengan izin edit employees atau owner berwenang penuh
    const isSelf = req.user.employeeId === parseInt(id, 10);
    let isAllowedToManage = req.user.role === 'owner';
    if (!isAllowedToManage) {
      const role = mapPositionToRole(req.user.position);
      const perm = await dbQuery.get("SELECT can_edit FROM position_permissions WHERE position = ? AND module = ?", [role, 'employees']);
      if (perm && perm.can_edit === 1) {
        isAllowedToManage = true;
      }
    }

    if (!isAllowedToManage) {
      if (!isSelf) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses ditolak: Anda tidak memiliki akses untuk mengupdate profil ini.'
        });
      }
      
      // Update terbatas untuk karyawan sendiri
      await dbQuery.run(`
        UPDATE employees
        SET full_name = ?, phone = ?, address = ?, gender = ?
        WHERE id = ?
      `, [
        full_name ? full_name.trim() : employee.full_name,
        phone ? phone.trim() : employee.phone,
        address ? address.trim() : employee.address,
        gender ? gender.trim() : (employee.gender || 'Pria'),
        id
      ]);
    } else {
      // Owner/Admin/Role berizin memiliki kontrol penuh atas jabatan, divisi, gaji, status, outlet, dan gender
      await dbQuery.run(`
        UPDATE employees
        SET full_name = ?, phone = ?, address = ?, position = ?, department = ?, basic_salary = ?, status = ?, joined_date = ?, outlet = ?, gender = ?
        WHERE id = ?
      `, [
        full_name ? full_name.trim() : employee.full_name,
        phone ? phone.trim() : employee.phone,
        address ? address.trim() : employee.address,
        position ? position.trim() : employee.position,
        department ? department.trim() : employee.department,
        basic_salary !== undefined ? parseFloat(basic_salary) : employee.basic_salary,
        status ? status : employee.status,
        joined_date ? joined_date : employee.joined_date,
        outlet ? outlet.trim() : employee.outlet,
        gender ? gender.trim() : (employee.gender || 'Pria'),
        id
      ]);

      // Jika menonaktifkan karyawan, kita juga ubah status user atau batasi loginnya
      if (status === 'inactive') {
        // Soft deactivation: Bisa juga ditandai di tabel users
        console.log(`Employee profile ${id} marked as inactive.`);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Profil karyawan berhasil diperbarui.'
    });

  } catch (error) {
    console.error('UpdateEmployee error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui data profil karyawan.'
    });
  }
}

/**
 * Menonaktifkan Akun Karyawan (Soft-Delete) - Khusus Owner/Admin
 */
export async function deactivateEmployee(req, res) {
  const { id } = req.params;

  try {
    const employee = await dbQuery.get("SELECT * FROM employees WHERE id = ?", [id]);
    if (!employee) {
      return res.status(404).json({
        status: 'error',
        message: 'Karyawan tidak ditemukan.'
      });
    }

    // Update status menjadi inactive (soft deletion)
    await dbQuery.run("UPDATE employees SET status = 'inactive' WHERE id = ?", [id]);
    
    // Opsional: Hapus user session dengan mengganti password_hash atau menonaktifkan akun di tabel user
    await dbQuery.run("UPDATE users SET role = 'employee' WHERE id = ?", [employee.user_id]); // Tetap role employee namun status profil nonaktif

    return res.status(200).json({
      status: 'success',
      message: 'Karyawan berhasil dinonaktifkan dari sistem.'
    });
  } catch (error) {
    console.error('DeactivateEmployee error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menonaktifkan karyawan.'
    });
  }
}

/**
 * Mendapatkan rekan kerja di outlet yang sama (untuk Penilaian 360)
 */
export async function getMyOutletColleagues(req, res) {
  try {
    const myOutlet = req.user.outlet;
    const myEmpId = req.user.employeeId;

    if (!myOutlet || !myEmpId) {
      return res.status(200).json({
        status: 'success',
        data: []
      });
    }

    const colleagues = await dbQuery.all(`
      SELECT e.id, e.nik, e.full_name, e.position, e.department, e.outlet
      FROM employees e
      WHERE e.outlet = ? AND e.id != ? AND e.status = 'active'
      ORDER BY e.full_name ASC
    `, [myOutlet, myEmpId]);

    return res.status(200).json({
      status: 'success',
      data: colleagues
    });
  } catch (error) {
    console.error('getMyOutletColleagues error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data rekan kerja satu outlet.'
    });
  }
}

