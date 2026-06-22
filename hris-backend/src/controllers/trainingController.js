import { dbQuery } from '../config/db.js';

export async function getTrainings(req, res) {
  const { status, divisi } = req.query;

  try {
    let sql = "SELECT * FROM trainings";
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    if (divisi) {
      conditions.push("divisi = ?");
      params.push(divisi);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY id DESC";

    const trainings = await dbQuery.all(sql, params);
    return res.status(200).json({
      status: 'success',
      data: trainings
    });
  } catch (error) {
    console.error('getTrainings error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data program pelatihan.'
    });
  }
}

export async function createTraining(req, res) {
  const { nama_program, divisi, tanggal_mulai, tanggal_selesai, kuota, status } = req.body;

  if (!nama_program || !divisi || !tanggal_mulai || !tanggal_selesai) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama program, divisi, tanggal mulai, dan tanggal selesai wajib diisi.'
    });
  }

  try {
    const existing = await dbQuery.get("SELECT id FROM trainings WHERE nama_program = ?", [nama_program.trim()]);
    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: 'Nama program pelatihan sudah terdaftar.'
      });
    }

    const result = await dbQuery.run(`
      INSERT INTO trainings (nama_program, divisi, tanggal_mulai, tanggal_selesai, kuota, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      nama_program.trim(),
      divisi.trim(),
      tanggal_mulai,
      tanggal_selesai,
      parseInt(kuota) || 10,
      status || 'mendatang'
    ]);

    return res.status(201).json({
      status: 'success',
      message: 'Program pelatihan baru berhasil didaftarkan.',
      data: {
        id: result.id,
        nama_program,
        divisi,
        tanggal_mulai,
        tanggal_selesai,
        kuota: parseInt(kuota) || 10,
        status: status || 'mendatang'
      }
    });
  } catch (error) {
    console.error('createTraining error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mendaftarkan program pelatihan.'
    });
  }
}

export async function updateTraining(req, res) {
  const { id } = req.params;
  const { nama_program, divisi, tanggal_mulai, tanggal_selesai, kuota, status } = req.body;

  if (!nama_program || !divisi || !tanggal_mulai || !tanggal_selesai) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama program, divisi, tanggal mulai, dan tanggal selesai wajib diisi.'
    });
  }

  try {
    const training = await dbQuery.get("SELECT id FROM trainings WHERE id = ?", [id]);
    if (!training) {
      return res.status(404).json({
        status: 'error',
        message: 'Program pelatihan tidak ditemukan.'
      });
    }

    const duplicate = await dbQuery.get("SELECT id FROM trainings WHERE nama_program = ? AND id != ?", [nama_program.trim(), id]);
    if (duplicate) {
      return res.status(400).json({
        status: 'error',
        message: 'Nama program pelatihan sudah digunakan oleh program lain.'
      });
    }

    await dbQuery.run(`
      UPDATE trainings
      SET nama_program = ?, divisi = ?, tanggal_mulai = ?, tanggal_selesai = ?, kuota = ?, status = ?
      WHERE id = ?
    `, [
      nama_program.trim(),
      divisi.trim(),
      tanggal_mulai,
      tanggal_selesai,
      parseInt(kuota) || 10,
      status || 'mendatang',
      id
    ]);

    return res.status(200).json({
      status: 'success',
      message: 'Program pelatihan berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateTraining error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui program pelatihan.'
    });
  }
}

export async function deleteTraining(req, res) {
  const { id } = req.params;

  try {
    const training = await dbQuery.get("SELECT id FROM trainings WHERE id = ?", [id]);
    if (!training) {
      return res.status(404).json({
        status: 'error',
        message: 'Program pelatihan tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM trainings WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Program pelatihan berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteTraining error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus program pelatihan.'
    });
  }
}
