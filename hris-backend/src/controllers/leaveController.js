import { dbQuery } from '../config/db.js';

/**
 * Helper to calculate cutoff range for an employee on a given date
 */
async function getCutoffRangeForEmployee(employee, dateStr) {
  const policies = await dbQuery.all("SELECT * FROM policies WHERE status = 'aktif'");
  const matchingPolicy = policies.find(p => 
    p.nama_kebijakan === 'Periode Cut-Off & Tanggal Gajian' &&
    (JSON.parse(p.berlaku_di || '[]').some(o => o.toUpperCase().trim() === (employee.outlet || '').toUpperCase().trim()))
  );

  let startDay = 4; // default fallback
  if (matchingPolicy && matchingPolicy.nilai) {
    const match = matchingPolicy.nilai.match(/Periode\s+Cut-Off:\s*(\d+)\s*-\s*(\d+)/i);
    if (match) {
      startDay = parseInt(match[1], 10);
    }
  }

  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  let startDate, endDate;
  if (startDay === 1) {
    const lastDay = new Date(year, month, 0).getDate();
    startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    if (date.getDate() >= startDay) {
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth === 13) {
        nextMonth = 1;
        nextYear = year + 1;
      }
      startDate = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(startDay - 1).padStart(2, '0')}`;
    } else {
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
      }
      startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(startDay - 1).padStart(2, '0')}`;
    }
  }
  return { startDate, endDate };
}

/**
 * Mengajukan Cuti/Izin/Sakit Baru (Karyawan via Android)
 */
export async function requestLeave(req, res) {
  const { leave_type, start_date, end_date, reason, attachment_url, half_day_clock_out, cash_advance_amount } = req.body;
  const employeeId = req.user.employeeId;

  if (!employeeId) {
    return res.status(400).json({
      status: 'error',
      message: 'Profil karyawan tidak ditemukan untuk akun Anda.'
    });
  }

  if (!leave_type || !start_date || !end_date || !reason) {
    return res.status(400).json({
      status: 'error',
      message: 'Kolom tipe pengajuan, tanggal mulai, tanggal berakhir, dan alasan wajib diisi.'
    });
  }

  // Validasi urutan tanggal
  if (new Date(start_date) > new Date(end_date)) {
    return res.status(400).json({
      status: 'error',
      message: 'Tanggal mulai tidak boleh lebih lambat dari tanggal berakhir.'
    });
  }

  try {
    const employee = await dbQuery.get("SELECT * FROM employees WHERE id = ?", [employeeId]);
    if (!employee) {
      return res.status(404).json({
        status: 'error',
        message: 'Profil karyawan tidak ditemukan.'
      });
    }

    // Strict Multi-Validation Matrix for Kasbon (cash advance)
    if (leave_type === 'kasbon') {
      const amount = parseFloat(cash_advance_amount) || 0;

      // Rule 1: Nominal once requested must not exceed 50% of Basic Salary
      if (amount > 0.5 * employee.basic_salary) {
        return res.status(400).json({
          status: 'error',
          message: '❌ Gagal: Pengajuan kasbon Anda melanggar ketentuan limit batas aman perusahaan!'
        });
      }

      // Rule 2: Nominal once requested must not exceed absolute Rp 500.000 limit
      if (amount > 500000) {
        return res.status(400).json({
          status: 'error',
          message: '❌ Gagal: Pengajuan kasbon Anda melanggar ketentuan limit batas aman perusahaan!'
        });
      }

      // Rule 3: Total accumulated approved kasbon for the same outlet/resto in current cutoff period must not exceed Rp 500.000 limit
      const cutoff = await getCutoffRangeForEmployee(employee, start_date);
      const outletApprovedKasbon = await dbQuery.get(`
        SELECT SUM(cash_advance_amount) as total
        FROM leaves
        WHERE employee_id IN (SELECT id FROM employees WHERE outlet = ?)
          AND leave_type = 'kasbon'
          AND status = 'approved'
          AND start_date >= ?
          AND start_date <= ?
      `, [employee.outlet, cutoff.startDate, cutoff.endDate]);

      const existingTotal = parseFloat(outletApprovedKasbon.total) || 0;
      if (existingTotal + amount > 500000) {
        return res.status(400).json({
          status: 'error',
          message: '❌ Gagal: Pengajuan kasbon Anda melanggar ketentuan limit batas aman perusahaan!'
        });
      }
    }

    // Simpan pengajuan
    const result = await dbQuery.run(`
      INSERT INTO leaves (employee_id, leave_type, start_date, end_date, reason, attachment_url, half_day_clock_out, cash_advance_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employeeId,
      leave_type,
      start_date,
      end_date,
      reason.trim(),
      attachment_url || null,
      leave_type === 'setengah_hari' ? half_day_clock_out : null,
      leave_type === 'kasbon' ? parseFloat(cash_advance_amount) : null
    ]);

    return res.status(201).json({
      status: 'success',
      message: 'Pengajuan cuti/izin/sakit berhasil diajukan dan sedang menunggu persetujuan.',
      data: {
        leaveId: result.id,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('RequestLeave error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memproses pengajuan izin.'
    });
  }
}

/**
 * Mendapatkan Daftar Pengajuan Cuti/Izin
 * - Karyawan hanya melihat milik sendiri.
 * - Owner/Admin dapat melihat semua.
 */
export async function getAllLeaves(req, res) {
  const { status } = req.query; // Filter by status: pending, approved, rejected

  try {
    let sql = `
      SELECT l.id, l.leave_type, l.start_date, l.end_date, l.reason, l.status, l.attachment_url, l.approval_date, l.created_at,
             l.half_day_clock_out, l.cash_advance_amount, l.is_sent, l.is_read,
             e.full_name, e.nik, e.position, e.department, e.outlet, u.email as approved_by_email
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      LEFT JOIN users u ON l.approved_by = u.id
    `;
    const params = [];

    const conditions = [];

    // Jika user adalah karyawan biasa, paksa hanya melihat miliknya sendiri
    if (req.user.role === 'employee') {
      conditions.push("l.employee_id = ?");
      params.push(req.user.employeeId);

      // Auto mark sent leaves as read when fetched by the employee
      try {
        await dbQuery.run(
          "UPDATE leaves SET is_read = 1 WHERE employee_id = ? AND is_sent = 1 AND is_read = 0",
          [req.user.employeeId]
        );
      } catch (err) {
        console.error('Auto-update leaves is_read error:', err.message);
      }
    }

    if (status) {
      conditions.push("l.status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY l.id DESC";

    const leaves = await dbQuery.all(sql, params);

    return res.status(200).json({
      status: 'success',
      data: leaves
    });
  } catch (error) {
    console.error('GetAllLeaves error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil daftar pengajuan izin.'
    });
  }
}

/**
 * Menyetujui atau Menolak Pengajuan (Khusus Owner/Admin via Web)
 */
export async function approveRejectLeave(req, res) {
  const { id } = req.params;
  const { status } = req.body; // 'approved' atau 'rejected'

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Status persetujuan harus berupa "approved" atau "rejected".'
    });
  }

  try {
    // 1. Cari pengajuan
    const leave = await dbQuery.get("SELECT * FROM leaves WHERE id = ?", [id]);
    if (!leave) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengajuan cuti/izin tidak ditemukan.'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: `Gagal: Pengajuan ini sudah diproses sebelumnya dengan status "${leave.status}".`
      });
    }

    const approvalDate = new Date().toISOString();

    // 2. Update status pengajuan
    await dbQuery.run(`
      UPDATE leaves
      SET status = ?, approved_by = ?, approval_date = ?
      WHERE id = ?
    `, [status, req.user.id, approvalDate, id]);

    return res.status(200).json({
      status: 'success',
      message: `Pengajuan cuti/izin berhasil diperbarui menjadi: ${status}.`
    });

  } catch (error) {
    console.error('ApproveRejectLeave error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memproses persetujuan cuti/izin.'
    });
  }
}

export async function updateLeave(req, res) {
  const { id } = req.params;
  const { leave_type, start_date, end_date, reason, attachment_url, status, half_day_clock_out, cash_advance_amount } = req.body;

  try {
    const leave = await dbQuery.get("SELECT id FROM leaves WHERE id = ?", [id]);
    if (!leave) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengajuan cuti/izin tidak ditemukan.'
      });
    }

    await dbQuery.run(
      `UPDATE leaves
       SET leave_type = ?, start_date = ?, end_date = ?, reason = ?, attachment_url = ?, status = ?, half_day_clock_out = ?, cash_advance_amount = ?
       WHERE id = ?`,
      [leave_type, start_date, end_date, reason.trim(), attachment_url || null, status || 'pending', half_day_clock_out || null, cash_advance_amount || null, id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Pengajuan cuti/izin berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateLeave error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengubah data pengajuan cuti/izin.'
    });
  }
}

export async function deleteLeave(req, res) {
  const { id } = req.params;

  try {
    const leave = await dbQuery.get("SELECT id FROM leaves WHERE id = ?", [id]);
    if (!leave) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengajuan cuti/izin tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM leaves WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Pengajuan cuti/izin berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteLeave error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus pengajuan cuti/izin.'
    });
  }
}

export async function sendLeaveNotification(req, res) {
  const { id } = req.params;
  try {
    const leave = await dbQuery.get("SELECT * FROM leaves WHERE id = ?", [id]);
    if (!leave) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengajuan cuti/izin tidak ditemukan.'
      });
    }

    if (leave.status !== 'approved') {
      return res.status(400).json({
        status: 'error',
        message: 'Hanya pengajuan yang telah disetujui yang dapat dikirim.'
      });
    }

    await dbQuery.run(
      "UPDATE leaves SET is_sent = 1 WHERE id = ?",
      [id]
    );

    // Get the employee name and outlet details
    const emp = await dbQuery.get("SELECT full_name, outlet FROM employees WHERE id = ?", [leave.employee_id]);
    const outletName = emp?.outlet || 'CABANG UTAMA';
    const label = leave.leave_type === 'cuti' ? 'Libur Reguler' : (leave.leave_type === 'sakit' ? 'Sakit' : (leave.leave_type === 'izin' ? 'Izin' : (leave.leave_type === 'setengah_hari' ? 'Masuk Setengah Hari' : 'Kasbon')));
    
    let msg = `🟢 Pengajuan ${label} Anda pada tanggal ${leave.start_date} telah DISETUJUI oleh Manajemen.`;
    if (leave.leave_type === 'kasbon') {
      const amountVal = leave.cash_advance_amount || 0.0;
      const cleanAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amountVal);
      msg = `🟢 Pengajuan Kasbon Anda sebesar ${cleanAmount} telah DISETUJUI. Dana langsung tercatat memotong gaji periode berjalan.`;
    }

    await dbQuery.run(
      `INSERT INTO mobile_user_notifications (employee_id, outlet, title, message, type, is_read)
       VALUES (?, ?, '🟢 PENGAJUAN DISETUJUI', ?, 'pengajuan', 0)`,
      [leave.employee_id, outletName, msg]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Notifikasi pengajuan berhasil dikirim ke mobile user.'
    });
  } catch (error) {
    console.error('sendLeaveNotification error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengirim notifikasi.'
    });
  }
}
