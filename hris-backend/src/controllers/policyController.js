import { dbQuery } from '../config/db.js';

export async function getPolicies(req, res) {
  try {
    const policies = await dbQuery.all("SELECT * FROM policies ORDER BY id DESC");
    return res.status(200).json({
      status: 'success',
      data: policies
    });
  } catch (error) {
    console.error('getPolicies error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data kebijakan perusahaan.'
    });
  }
}

export async function createPolicy(req, res) {
  const { nama_kebijakan, kategori, nilai, efek_performa, keterangan, status, hanya_outlet_terpilih, berlaku_di } = req.body;

  if (!nama_kebijakan || !kategori || !nilai) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama kebijakan, kategori, dan nilai/ketentuan wajib diisi.'
    });
  }

  const validCategories = ['jam_kerja', 'hari_libur', 'performa', 'lainnya'];
  if (!validCategories.includes(kategori)) {
    return res.status(400).json({
      status: 'error',
      message: 'Kategori kebijakan tidak valid.'
    });
  }

  try {
    const policyStatus = status === 'nonaktif' ? 'nonaktif' : 'aktif';
    const berlakuDiStr = Array.isArray(berlaku_di) ? JSON.stringify(berlaku_di) : (berlaku_di || '[]');
    const statusHanyaOutlet = hanya_outlet_terpilih ? 1 : 0;

    const result = await dbQuery.run(
      `INSERT INTO policies (nama_kebijakan, kategori, nilai, efek_performa, keterangan, status, hanya_outlet_terpilih, berlaku_di)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nama_kebijakan.trim(),
        kategori,
        nilai.trim(),
        efek_performa ? efek_performa.trim() : null,
        keterangan ? keterangan.trim() : null,
        policyStatus,
        statusHanyaOutlet,
        berlakuDiStr
      ]
    );


    return res.status(201).json({
      status: 'success',
      message: 'Kebijakan perusahaan baru berhasil dibuat.',
      data: { id: result.id }
    });
  } catch (error) {
    console.error('createPolicy error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat kebijakan perusahaan baru.'
    });
  }
}

export async function updatePolicy(req, res) {
  const { id } = req.params;
  const { nama_kebijakan, kategori, nilai, efek_performa, keterangan, status, hanya_outlet_terpilih, berlaku_di } = req.body;

  if (!nama_kebijakan || !kategori || !nilai) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama kebijakan, kategori, dan nilai/ketentuan wajib diisi.'
    });
  }

  const validCategories = ['jam_kerja', 'hari_libur', 'performa', 'lainnya'];
  if (!validCategories.includes(kategori)) {
    return res.status(400).json({
      status: 'error',
      message: 'Kategori kebijakan tidak valid.'
    });
  }

  try {
    const policy = await dbQuery.get("SELECT id FROM policies WHERE id = ?", [id]);
    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Kebijakan perusahaan tidak ditemukan.'
      });
    }

    const policyStatus = status === 'nonaktif' ? 'nonaktif' : 'aktif';
    const berlakuDiStr = Array.isArray(berlaku_di) ? JSON.stringify(berlaku_di) : (berlaku_di || '[]');
    const statusHanyaOutlet = hanya_outlet_terpilih ? 1 : 0;

    await dbQuery.run(
      `UPDATE policies 
       SET nama_kebijakan = ?, kategori = ?, nilai = ?, efek_performa = ?, keterangan = ?, status = ?, hanya_outlet_terpilih = ?, berlaku_di = ?
       WHERE id = ?`,
      [
        nama_kebijakan.trim(),
        kategori,
        nilai.trim(),
        efek_performa ? efek_performa.trim() : null,
        keterangan ? keterangan.trim() : null,
        policyStatus,
        statusHanyaOutlet,
        berlakuDiStr,
        id
      ]
    );


    return res.status(200).json({
      status: 'success',
      message: 'Kebijakan perusahaan berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updatePolicy error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui kebijakan perusahaan.'
    });
  }
}

export async function deletePolicy(req, res) {
  const { id } = req.params;

  try {
    const policy = await dbQuery.get("SELECT id FROM policies WHERE id = ?", [id]);
    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Kebijakan perusahaan tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM policies WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Kebijakan perusahaan berhasil dihapus.'
    });
  } catch (error) {
    console.error('deletePolicy error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus kebijakan perusahaan.'
    });
  }
}

export async function syncPolicies(req, res) {
  const { policies } = req.body;
  if (!Array.isArray(policies)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid policies array.'
    });
  }

  try {
    await dbQuery.run("BEGIN TRANSACTION");
    try {
      await dbQuery.run("DELETE FROM policies");

      for (const p of policies) {
        const berlakuDiStr = Array.isArray(p.outlets) ? JSON.stringify(p.outlets) : (p.berlaku_di || '[]');
        const statusHanyaOutlet = p.all_outlets ? 0 : 1;
        
        let val = p.nilai || p.deskripsi || '';
        if (typeof val !== 'string') {
          val = JSON.stringify(val);
        }

        await dbQuery.run(
          `INSERT INTO policies (nama_kebijakan, kategori, nilai, keterangan, status, hanya_outlet_terpilih, berlaku_di)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            p.nama_aturan || p.nama_kebijakan || '',
            p.kategori || 'jam_kerja',
            val,
            p.keterangan || p.deskripsi || '',
            p.status === 'ACTIVE' || p.status === 'aktif' ? 'aktif' : 'nonaktif',
            statusHanyaOutlet,
            berlakuDiStr
          ]
        );
      }
      await dbQuery.run("COMMIT");
    } catch (loopError) {
      await dbQuery.run("ROLLBACK");
      throw loopError;
    }

    return res.status(200).json({
      status: 'success',
      message: 'Kebijakan perusahaan berhasil disinkronisasi ke database.'
    });
  } catch (error) {
    console.error('syncPolicies error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal melakukan sinkronisasi kebijakan ke database.'
    });
  }
}

export async function getPeakDays(req, res) {
  try {
    const peakDays = await dbQuery.all("SELECT * FROM peak_days ORDER BY id ASC");
    return res.status(200).json({
      status: 'success',
      data: peakDays
    });
  } catch (error) {
    console.error('getPeakDays error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data peak days.'
    });
  }
}

export async function createPeakDay(req, res) {
  const { tanggal, bulan, tahun, nama_peak_day } = req.body;
  if (!tanggal || !bulan || !tahun || !nama_peak_day) {
    return res.status(400).json({
      status: 'error',
      message: 'Semua field wajib diisi.'
    });
  }
  try {
    const result = await dbQuery.run(
      "INSERT INTO peak_days (tanggal, bulan, tahun, nama_peak_day) VALUES (?, ?, ?, ?)",
      [parseInt(tanggal), parseInt(bulan), parseInt(tahun), nama_peak_day.trim()]
    );
    return res.status(201).json({
      status: 'success',
      message: 'Peak Day berhasil ditambahkan.',
      data: { id: result.id, tanggal, bulan, tahun, nama_peak_day }
    });
  } catch (error) {
    console.error('createPeakDay error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menambahkan Peak Day.'
    });
  }
}

export async function deletePeakDay(req, res) {
  const { id } = req.params;
  try {
    await dbQuery.run("DELETE FROM peak_days WHERE id = ?", [id]);
    return res.status(200).json({
      status: 'success',
      message: 'Peak Day berhasil dihapus.'
    });
  } catch (error) {
    console.error('deletePeakDay error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus Peak Day.'
    });
  }
}

export async function syncPeakDays(req, res) {
  const peak_days = req.body.peak_days || req.body.peakDays;
  if (!Array.isArray(peak_days)) {
    return res.status(400).json({
      status: 'error',
      message: 'Format peak_days tidak valid.'
    });
  }
  try {
    await dbQuery.run("BEGIN TRANSACTION");
    try {
      await dbQuery.run("DELETE FROM peak_days");
      for (const p of peak_days) {
        await dbQuery.run(
          "INSERT INTO peak_days (tanggal, bulan, tahun, nama_peak_day) VALUES (?, ?, ?, ?)",
          [parseInt(p.tanggal), parseInt(p.bulan), parseInt(p.tahun), p.nama_peak_day]
        );
      }
      await dbQuery.run("COMMIT");
    } catch (loopError) {
      await dbQuery.run("ROLLBACK");
      throw loopError;
    }
    return res.status(200).json({
      status: 'success',
      message: 'Peak Days berhasil disinkronisasi.'
    });
  } catch (error) {
    console.error('syncPeakDays error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal melakukan sinkronisasi Peak Days.'
    });
  }
}
