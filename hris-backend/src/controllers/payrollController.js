import { dbQuery } from '../config/db.js';

const LATE_DEDUCTION_AMOUNT = 50000.0; // Potongan terlambat: Rp 50.000 per terlambat
const DEFAULT_ALLOWANCE = 500000.0; // Tunjangan makan & transport default: Rp 500.000

/**
 * Menghasilkan rekapan payroll bulanan karyawan (Khusus Owner/Admin)
 * Gaji bersih = Gaji Pokok + Tunjangan - Potongan (Terlambat)
 */
export async function generatePayroll(req, res) {
  const { period } = req.body; // format: YYYY-MM (contoh: 2026-05)

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({
      status: 'error',
      message: 'Periode tidak valid. Gunakan format YYYY-MM (misal: 2026-05).'
    });
  }

  try {
    // 1. Ambil semua karyawan aktif
    const employees = await dbQuery.all("SELECT id, basic_salary, full_name FROM employees WHERE status = 'active'");
    if (employees.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada karyawan aktif untuk diproses payroll-nya.'
      });
    }

    const results = [];

    // Mulai transaksi tulis massal
    await dbQuery.run("BEGIN TRANSACTION");

    try {
      // 2. Hitung payroll untuk masing-masing karyawan
      for (const emp of employees) {
        // Hitung jumlah keterlambatan bulan tersebut
        const lateData = await dbQuery.get(
          "SELECT COUNT(*) as late_count FROM attendances WHERE employee_id = ? AND date LIKE ? AND status_in = 'late'",
          [emp.id, `${period}%`]
        );
        const lateCount = lateData ? lateData.late_count : 0;

        // Hitung potongan keterlambatan
        const deductions = lateCount * LATE_DEDUCTION_AMOUNT;
        const allowances = DEFAULT_ALLOWANCE;
        const netSalary = emp.basic_salary + allowances - deductions;

        // Hapus jika sudah ada data payroll untuk periode tersebut agar tidak terjadi duplikasi (idempotent)
        await dbQuery.run("DELETE FROM payrolls WHERE employee_id = ? AND period = ?", [emp.id, period]);

        // Masukkan record payroll baru
        await dbQuery.run(`
          INSERT INTO payrolls (employee_id, period, basic_salary, allowances, deductions, net_salary, payment_status)
          VALUES (?, ?, ?, ?, ?, ?, 'unpaid')
        `, [emp.id, period, emp.basic_salary, allowances, deductions, netSalary]);

        results.push({
          employeeId: emp.id,
          fullName: emp.full_name,
          basicSalary: emp.basic_salary,
          allowances,
          deductions,
          netSalary,
          lateCount
        });
      }
      await dbQuery.run("COMMIT");
    } catch (loopError) {
      await dbQuery.run("ROLLBACK");
      throw loopError;
    }

    return res.status(200).json({
      status: 'success',
      message: `Payroll untuk periode ${period} berhasil di-generate bagi ${employees.length} karyawan aktif.`,
      data: results
    });

  } catch (error) {
    console.error('GeneratePayroll error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memproses perhitungan payroll bulanan.'
    });
  }
}

/**
 * Mendapatkan Daftar Payroll/Slip Gaji
 * - Karyawan hanya bisa melihat miliknya sendiri.
 * - Owner/Admin bisa melihat semua.
 */
export async function getAllPayrolls(req, res) {
  const { period, employeeId } = req.query;

  try {
    let sql = `
      SELECT p.id, p.period, p.basic_salary, p.allowances, p.deductions, p.net_salary, p.payment_status, p.payment_date, p.slip_url,
             p.is_sent, p.is_read,
             e.full_name, e.nik, e.position, e.department
      FROM payrolls p
      JOIN employees e ON p.employee_id = e.id
    `;
    const params = [];
    const conditions = [];

    // Jika karyawan biasa, paksa filter berdasarkan diri sendiri
    if (req.user.role === 'employee') {
      conditions.push("p.employee_id = ?");
      params.push(req.user.employeeId);
    } else {
      if (employeeId) {
        conditions.push("p.employee_id = ?");
        params.push(employeeId);
      }
    }

    if (period) {
      conditions.push("p.period = ?");
      params.push(period);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY p.period DESC, p.id DESC";

    const payrolls = await dbQuery.all(sql, params);

    // Auto mark read if employee retrieving their slips
    if (req.user.role === 'employee' && payrolls.length > 0) {
      await dbQuery.run("UPDATE payrolls SET is_read = 1 WHERE employee_id = ? AND is_sent = 1", [req.user.employeeId]);
    }

    return res.status(200).json({
      status: 'success',
      data: payrolls
    });
  } catch (error) {
    console.error('GetAllPayrolls error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat rekapitulasi slip gaji.'
    });
  }
}

/**
 * Memperbarui Status Pembayaran Gaji (Khusus Owner/Admin via Web)
 */
export async function updatePaymentStatus(req, res) {
  const { id } = req.params;
  const { payment_status } = req.body; // 'paid' atau 'unpaid'

  if (!payment_status || !['paid', 'unpaid'].includes(payment_status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Status pembayaran harus berupa "paid" atau "unpaid".'
    });
  }

  try {
    const payroll = await dbQuery.get("SELECT id FROM payrolls WHERE id = ?", [id]);
    if (!payroll) {
      return res.status(404).json({
        status: 'error',
        message: 'Slip gaji tidak ditemukan.'
      });
    }

    const paymentDate = payment_status === 'paid' ? new Date().toISOString() : null;

    // Update status bayar
    await dbQuery.run(`
      UPDATE payrolls
      SET payment_status = ?, payment_date = ?
      WHERE id = ?
    `, [payment_status, paymentDate, id]);

    return res.status(200).json({
      status: 'success',
      message: `Status pembayaran slip gaji berhasil diubah menjadi: ${payment_status}.`
    });

  } catch (error) {
    console.error('UpdatePaymentStatus error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui status pembayaran gaji.'
    });
  }
}

/**
 * Memperbarui Rincian Gaji Bulanan Karyawan (Khusus Owner/Admin via Web)
 */
export async function updatePayroll(req, res) {
  const { id } = req.params;
  const { basic_salary, allowances, deductions } = req.body;

  if (basic_salary === undefined || allowances === undefined || deductions === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Gaji pokok, tunjangan, dan potongan wajib disertakan.'
    });
  }

  try {
    const payroll = await dbQuery.get("SELECT id FROM payrolls WHERE id = ?", [id]);
    if (!payroll) {
      return res.status(404).json({
        status: 'error',
        message: 'Slip gaji tidak ditemukan.'
      });
    }

    const basic = parseFloat(basic_salary) || 0;
    const allow = parseFloat(allowances) || 0;
    const deduct = parseFloat(deductions) || 0;
    const netSalary = basic + allow - deduct;

    await dbQuery.run(`
      UPDATE payrolls
      SET basic_salary = ?, allowances = ?, deductions = ?, net_salary = ?
      WHERE id = ?
    `, [basic, allow, deduct, netSalary, id]);

    return res.status(200).json({
      status: 'success',
      message: 'Data slip gaji berhasil diperbarui.',
      data: { basic_salary: basic, allowances: allow, deductions: deduct, net_salary: netSalary }
    });
  } catch (error) {
    console.error('UpdatePayroll error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui data slip gaji.'
    });
  }
}

/**
 * Menghapus Slip Gaji Karyawan Secara Permanen (Khusus Owner/Admin via Web)
 */
export async function deletePayroll(req, res) {
  const { id } = req.params;

  try {
    const payroll = await dbQuery.get("SELECT id FROM payrolls WHERE id = ?", [id]);
    if (!payroll) {
      return res.status(404).json({
        status: 'error',
        message: 'Slip gaji tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM payrolls WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Slip gaji berhasil dihapus secara permanen.'
    });
  } catch (error) {
    console.error('DeletePayroll error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus data slip gaji.'
    });
  }
}

/**
 * Mengirim Slip Gaji (is_sent = 1)
 */
export async function sendPayrollSlip(req, res) {
  const { id } = req.params;

  try {
    const payroll = await dbQuery.get("SELECT id FROM payrolls WHERE id = ?", [id]);
    if (!payroll) {
      return res.status(404).json({
        status: 'error',
        message: 'Slip gaji tidak ditemukan.'
      });
    }

    await dbQuery.run("UPDATE payrolls SET is_sent = 1 WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Slip gaji berhasil dikirim ke mobile.'
    });
  } catch (error) {
    console.error('SendPayrollSlip error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengirim slip gaji.'
    });
  }
}

