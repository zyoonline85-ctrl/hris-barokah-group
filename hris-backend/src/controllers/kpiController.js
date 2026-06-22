import { dbQuery } from '../config/db.js';

export async function getKpis(req, res) {
  const { employee_id, periode } = req.query;

  try {
    let sql = `
      SELECT k.*, e.full_name as nama_karyawan, e.nik as nik_karyawan, e.department, e.position, eval.full_name as nama_evaluator
      FROM kpis k
      JOIN employees e ON k.employee_id = e.id
      JOIN users u ON k.evaluator_id = u.id
      LEFT JOIN employees eval ON eval.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    // Jika karyawan biasa, paksa hanya melihat KPI dirinya
    if (req.user.role === 'employee') {
      conditions.push("k.employee_id = ?");
      params.push(req.user.employeeId);
    } else if (employee_id) {
      conditions.push("k.employee_id = ?");
      params.push(employee_id);
    }

    if (periode) {
      conditions.push("k.periode = ?");
      params.push(periode);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY k.periode DESC, k.id DESC";

    const kpis = await dbQuery.all(sql, params);
    return res.status(200).json({
      status: 'success',
      data: kpis
    });
  } catch (error) {
    console.error('getKpis error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data evaluasi KPI.'
    });
  }
}

export async function createOrUpdateKpi(req, res) {
  const { employee_id, periode, skor_kpi, catatan } = req.body;
  const evaluatorId = req.user.id;

  if (!employee_id || !periode || skor_kpi === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'ID Karyawan, periode (YYYY-MM), dan skor KPI wajib diisi.'
    });
  }

  try {
    // Validasi karyawan eksis
    const emp = await dbQuery.get("SELECT id FROM employees WHERE id = ?", [employee_id]);
    if (!emp) {
      return res.status(404).json({
        status: 'error',
        message: 'Karyawan tidak ditemukan.'
      });
    }

    // Gunakan INSERT OR REPLACE atau INSERT ... ON CONFLICT
    await dbQuery.run(
      `INSERT INTO kpis (employee_id, periode, skor_kpi, evaluator_id, catatan)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(employee_id, periode) 
       DO UPDATE SET skor_kpi = excluded.skor_kpi, evaluator_id = excluded.evaluator_id, catatan = excluded.catatan`,
      [employee_id, periode, parseFloat(skor_kpi), evaluatorId, catatan ? catatan.trim() : null]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Nilai KPI karyawan berhasil disimpan.'
    });
  } catch (error) {
    console.error('createOrUpdateKpi error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menyimpan nilai KPI karyawan.'
    });
  }
}

export async function deleteKpi(req, res) {
  const { id } = req.params;

  try {
    const kpi = await dbQuery.get("SELECT id FROM kpis WHERE id = ?", [id]);
    if (!kpi) {
      return res.status(404).json({
        status: 'error',
        message: 'Data KPI tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM kpis WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Data evaluasi KPI berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteKpi error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus data KPI.'
    });
  }
}

/**
 * Menyimpan penilaian 360 sejawat secara anonim
 */
export async function create360Rating(req, res) {
  const { employee_id, kedisiplinan, inisiatif, kerjasama, kebersihan, etika } = req.body;

  if (!employee_id || kedisiplinan === undefined || inisiatif === undefined || kerjasama === undefined || kebersihan === undefined || etika === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'ID karyawan yang dinilai dan seluruh nilai kompetensi wajib diisi.'
    });
  }

  // Parse skor ke integer
  const scores = {
    kedisiplinan: parseInt(kedisiplinan, 10),
    inisiatif: parseInt(inisiatif, 10),
    kerjasama: parseInt(kerjasama, 10),
    kebersihan: parseInt(kebersihan, 10),
    etika: parseInt(etika, 10)
  };

  // Validasi rentang nilai 1-5
  for (const [key, val] of Object.entries(scores)) {
    if (isNaN(val) || val < 1 || val > 5) {
      return res.status(400).json({
        status: 'error',
        message: `Nilai untuk kompetensi ${key} harus bernilai antara 1 sampai 5.`
      });
    }
  }

  try {
    // Validasi target karyawan ada dan aktif
    const emp = await dbQuery.get("SELECT id, status FROM employees WHERE id = ?", [employee_id]);
    if (!emp) {
      return res.status(404).json({
        status: 'error',
        message: 'Karyawan yang dinilai tidak ditemukan.'
      });
    }

    if (emp.status !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: 'Karyawan yang dinilai sudah tidak aktif.'
      });
    }

    // Simpan secara anonim (dilarang menyimpan rater/evaluator_id)
    await dbQuery.run(
      `INSERT INTO ratings_360 (employee_id, kedisiplinan, inisiatif, kerjasama, kebersihan, etika)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, scores.kedisiplinan, scores.inisiatif, scores.kerjasama, scores.kebersihan, scores.etika]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Penilaian 360° berhasil dikirimkan secara anonim!'
    });
  } catch (error) {
    console.error('create360Rating error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengirimkan penilaian 360°.'
    });
  }
}

/**
 * Mengambil semua data penilaian 360 (owner/admin melihat semua, employee melihat miliknya sendiri)
 */
export async function get360Ratings(req, res) {
  try {
    let sql = `
      SELECT r.*, e.full_name as nama_karyawan, e.nik as nik_karyawan, e.department, e.position, e.outlet
      FROM ratings_360 r
      JOIN employees e ON r.employee_id = e.id
    `;
    const params = [];

    // Jika karyawan biasa, paksa hanya melihat rating miliknya sendiri
    if (req.user.role === 'employee') {
      sql += " WHERE r.employee_id = ?";
      params.push(req.user.employeeId);
    }

    sql += " ORDER BY r.created_at DESC, r.id DESC";

    const ratings = await dbQuery.all(sql, params);
    return res.status(200).json({
      status: 'success',
      data: ratings
    });
  } catch (error) {
    console.error('get360Ratings error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data penilaian 360°.'
    });
  }
}

