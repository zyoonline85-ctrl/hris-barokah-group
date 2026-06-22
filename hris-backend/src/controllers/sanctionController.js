import { dbQuery } from '../config/db.js';

/**
 * Mengambil daftar karyawan aktif untuk keperluan form sanksi.
 * Endpoint ini accessible bagi siapapun yang punya izin sanctions/view,
 * sehingga tidak bergantung pada izin terpisah modul 'employees'.
 */
export async function getEmployeesForSanction(req, res) {
  try {
    const employees = await dbQuery.all(`
      SELECT e.id, e.nik, e.full_name, e.position, e.department, e.outlet, e.status
      FROM employees e
      WHERE e.status = 'active' OR e.status IS NULL
      ORDER BY e.outlet ASC, e.full_name ASC
    `);
    return res.status(200).json({ status: 'success', data: employees });
  } catch (error) {
    console.error('getEmployeesForSanction error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data karyawan.' });
  }
}

function calculateEndDate(startDateStr, type) {
  const start = new Date(startDateStr);
  const months = type.startsWith('Surat Teguran Lisan') ? 3 : 6;
  start.setMonth(start.getMonth() + months);
  return start.toISOString().split('T')[0];
}

function getDiketahuiOleh(type) {
  if (type.startsWith('Surat Teguran Lisan')) {
    return 'SPV';
  } else if (type === 'Surat Peringatan 1' || type === 'Surat Peringatan 2') {
    return 'Manajemen';
  } else {
    return 'General Manager';
  }
}

export async function getSanctions(req, res) {
  const { employee_id, status } = req.query;

  try {
    let sql = `
      SELECT s.*, e.full_name as nama_karyawan, e.nik as nik_karyawan, e.department, e.position, e.outlet
      FROM sanctions s
      JOIN employees e ON s.employee_id = e.id
    `;
    const params = [];
    const conditions = [];

    // Jika karyawan biasa, paksa hanya melihat sanksi dirinya
    if (req.user.role === 'employee') {
      conditions.push("s.employee_id = ?");
      params.push(req.user.employeeId);
    } else if (employee_id) {
      conditions.push("s.employee_id = ?");
      params.push(employee_id);
    }

    if (status) {
      conditions.push("s.status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.tanggal_berlaku DESC, s.id DESC";

    const sanctions = await dbQuery.all(sql, params);
    return res.status(200).json({
      status: 'success',
      data: sanctions
    });
  } catch (error) {
    console.error('getSanctions error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data sanksi disiplin.'
    });
  }
}

export async function createSanction(req, res) {
  const { employee_id, tipe_sanksi, bentuk_kesalahan, alasan, tanggal_berlaku, tanggal_terbit } = req.body;

  if (!employee_id || !tipe_sanksi || !bentuk_kesalahan || !alasan || !tanggal_berlaku) {
    return res.status(400).json({
      status: 'error',
      message: 'ID Karyawan, tipe sanksi, bentuk kesalahan, alasan, dan tanggal berlaku wajib diisi.'
    });
  }

  const validTypes = [
    'Surat Teguran Lisan 1',
    'Surat Teguran Lisan 2',
    'Surat Teguran Lisan 3',
    'Surat Peringatan 1',
    'Surat Peringatan 2',
    'Surat Peringatan 3',
    'PHK'
  ];

  if (!validTypes.includes(tipe_sanksi)) {
    return res.status(400).json({
      status: 'error',
      message: 'Tipe sanksi tidak valid.'
    });
  }

  const validBentuk = ['Pelanggaran Kode Etik', 'Pelanggaran Teknis'];
  if (!validBentuk.includes(bentuk_kesalahan)) {
    return res.status(400).json({
      status: 'error',
      message: 'Bentuk kesalahan tidak valid.'
    });
  }

  try {
    const emp = await dbQuery.get("SELECT id, outlet FROM employees WHERE id = ?", [employee_id]);
    if (!emp) {
      return res.status(404).json({
        status: 'error',
        message: 'Karyawan tidak ditemukan.'
      });
    }

    const tanggal_terbit_val = tanggal_terbit || tanggal_berlaku || new Date().toISOString().split('T')[0];
    const tanggal_berakhir = calculateEndDate(tanggal_terbit_val, tipe_sanksi);
    const diketahui_oleh = getDiketahuiOleh(tipe_sanksi);

    const result = await dbQuery.run(
      `INSERT INTO sanctions (employee_id, tipe_sanksi, bentuk_kesalahan, alasan, tanggal_berlaku, tanggal_berakhir, status, diketahui_oleh, tanggal_terbit)
       VALUES (?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`,
      [employee_id, tipe_sanksi, bentuk_kesalahan, alasan.trim(), tanggal_berlaku, tanggal_berakhir, diketahui_oleh, tanggal_terbit_val]
    );

    // Auto-inject notification to mobile_user_notifications
    const outletName = emp.outlet || 'CABANG UTAMA';
    const notifMessage = `⚠️ PEMBERITAHUAN DISIPLIN: Anda menerima ${tipe_sanksi} resmi dari manajemen atas perkara ${bentuk_kesalahan}. Sifat surat: Mengikat.`;
    
    await dbQuery.run(
      `INSERT INTO mobile_user_notifications (employee_id, outlet, title, message, type, is_read)
       VALUES (?, ?, '⚠️ PEMBERITAHUAN DISIPLIN', ?, 'disiplin', 0)`,
      [employee_id, outletName, notifMessage]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Surat peringatan/tindakan sanksi berhasil diterbitkan.',
      data: {
        id: result.id,
        employee_id,
        tipe_sanksi,
        bentuk_kesalahan,
        alasan,
        tanggal_berlaku,
        tanggal_berakhir,
        diketahui_oleh,
        tanggal_terbit: tanggal_terbit_val,
        status: 'aktif'
      }
    });
  } catch (error) {
    console.error('createSanction error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menerbitkan sanksi disiplin.'
    });
  }
}

export async function updateSanctionStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['aktif', 'selesai'].includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Status sanksi tidak valid. Harus aktif atau selesai.'
    });
  }

  try {
    const sanction = await dbQuery.get("SELECT id FROM sanctions WHERE id = ?", [id]);
    if (!sanction) {
      return res.status(404).json({
        status: 'error',
        message: 'Data sanksi tidak ditemukan.'
      });
    }

    await dbQuery.run(
      "UPDATE sanctions SET status = ? WHERE id = ?",
      [status, id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Status sanksi disiplin berhasil diubah.'
    });
  } catch (error) {
    console.error('updateSanctionStatus error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal merubah status sanksi.'
    });
  }
}

export async function deleteSanction(req, res) {
  const { id } = req.params;

  try {
    const sanction = await dbQuery.get("SELECT id FROM sanctions WHERE id = ?", [id]);
    if (!sanction) {
      return res.status(404).json({
        status: 'error',
        message: 'Data sanksi tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM sanctions WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Data sanksi berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteSanction error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus data sanksi.'
    });
  }
}

export async function updateSanction(req, res) {
  const { id } = req.params;
  const { employee_id, tipe_sanksi, bentuk_kesalahan, alasan, tanggal_berlaku, status, tanggal_terbit } = req.body;

  try {
    const sanction = await dbQuery.get("SELECT id FROM sanctions WHERE id = ?", [id]);
    if (!sanction) {
      return res.status(404).json({
        status: 'error',
        message: 'Data sanksi tidak ditemukan.'
      });
    }

    const tanggal_terbit_val = tanggal_terbit || tanggal_berlaku || new Date().toISOString().split('T')[0];
    const tanggal_berakhir = calculateEndDate(tanggal_terbit_val, tipe_sanksi);
    const diketahui_oleh = getDiketahuiOleh(tipe_sanksi);

    await dbQuery.run(
      `UPDATE sanctions
       SET employee_id = ?, tipe_sanksi = ?, bentuk_kesalahan = ?, alasan = ?, tanggal_berlaku = ?, tanggal_berakhir = ?, status = ?, diketahui_oleh = ?, tanggal_terbit = ?
       WHERE id = ?`,
      [employee_id, tipe_sanksi, bentuk_kesalahan, alasan.trim(), tanggal_berlaku, tanggal_berakhir, status || 'aktif', diketahui_oleh, tanggal_terbit_val, id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Data sanksi disiplin berhasil diubah.'
    });
  } catch (error) {
    console.error('updateSanction error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal merubah data sanksi.'
    });
  }
}
