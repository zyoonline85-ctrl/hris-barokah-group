import { dbQuery } from '../config/db.js';

// === MANAJEMEN OUTLET ===

export async function getOutlets(req, res) {
  try {
    const outlets = await dbQuery.all("SELECT * FROM outlets ORDER BY nama ASC");
    return res.status(200).json({
      status: 'success',
      data: outlets
    });
  } catch (error) {
    console.error('getOutlets error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data outlet.'
    });
  }
}

export async function createOutlet(req, res) {
  const { nama, wilayah, alamat, permodalan, status } = req.body;

  if (!nama || !wilayah || !alamat || !permodalan) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama, wilayah, alamat, dan permodalan outlet wajib diisi.'
    });
  }

  try {
    // Cek duplikasi nama
    const existing = await dbQuery.get("SELECT id FROM outlets WHERE nama = ?", [nama.trim()]);
    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: 'Nama outlet tersebut sudah terdaftar di sistem.'
      });
    }

    const result = await dbQuery.run(
      "INSERT INTO outlets (nama, wilayah, alamat, permodalan, status) VALUES (?, ?, ?, ?, ?)",
      [
        nama.trim(),
        wilayah.trim(),
        alamat.trim(),
        permodalan.trim(),
        status ? status.trim() : 'active'
      ]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Outlet baru berhasil ditambahkan.',
      data: { id: result.id, nama, wilayah, alamat, permodalan, status: status || 'active' }
    });
  } catch (error) {
    console.error('createOutlet error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menambahkan outlet.'
    });
  }
}


export async function updateOutlet(req, res) {
  const { id } = req.params;
  const { nama, wilayah, alamat, permodalan, status } = req.body;

  if (!nama || !wilayah || !alamat || !permodalan) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama, wilayah, alamat, dan permodalan outlet wajib diisi.'
    });
  }

  try {
    const outlet = await dbQuery.get("SELECT id FROM outlets WHERE id = ?", [id]);
    if (!outlet) {
      return res.status(404).json({
        status: 'error',
        message: 'Data outlet tidak ditemukan.'
      });
    }

    // Cek duplikasi nama (jika ganti nama)
    const existing = await dbQuery.get("SELECT id FROM outlets WHERE nama = ? AND id != ?", [nama.trim(), id]);
    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: 'Nama outlet tersebut sudah digunakan oleh outlet lain.'
      });
    }

    await dbQuery.run(
      "UPDATE outlets SET nama = ?, wilayah = ?, alamat = ?, permodalan = ?, status = ? WHERE id = ?",
      [
        nama.trim(),
        wilayah.trim(),
        alamat.trim(),
        permodalan.trim(),
        status ? status.trim() : 'active',
        id
      ]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Data outlet berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateOutlet error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui data outlet.'
    });
  }
}


export async function deleteOutlet(req, res) {
  const { id } = req.params;

  try {
    const outlet = await dbQuery.get("SELECT id FROM outlets WHERE id = ?", [id]);
    if (!outlet) {
      return res.status(404).json({
        status: 'error',
        message: 'Data outlet tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM outlets WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Outlet berhasil dihapus dari sistem.'
    });
  } catch (error) {
    console.error('deleteOutlet error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus outlet.'
    });
  }
}

// === MANAJEMEN OMZET OUTLET (REVENUE) ===

export async function getRevenues(req, res) {
  const { outlet_id, tanggal } = req.query;

  try {
    let sql = `
      SELECT r.*, o.nama as nama_outlet, e.full_name as nama_pencatat
      FROM outlet_revenues r
      JOIN outlets o ON r.outlet_id = o.id
      JOIN users u ON r.dicatat_oleh = u.id
      LEFT JOIN employees e ON e.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (outlet_id) {
      conditions.push("r.outlet_id = ?");
      params.push(outlet_id);
    }

    if (tanggal) {
      conditions.push("r.tanggal = ?");
      params.push(tanggal);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY r.tanggal DESC, r.id DESC";

    const revenues = await dbQuery.all(sql, params);

    return res.status(200).json({
      status: 'success',
      data: revenues
    });
  } catch (error) {
    console.error('getRevenues error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data omzet.'
    });
  }
}

export async function createRevenue(req, res) {
  const { outlet_id, tanggal, jumlah_omzet } = req.body;
  const userId = req.user.id;

  if (!outlet_id || !tanggal || jumlah_omzet === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Outlet, tanggal, dan jumlah omzet wajib diisi.'
    });
  }

  try {
    // Validasi outlet eksis
    const outlet = await dbQuery.get("SELECT id FROM outlets WHERE id = ?", [outlet_id]);
    if (!outlet) {
      return res.status(404).json({
        status: 'error',
        message: 'Data outlet tidak ditemukan.'
      });
    }

    const result = await dbQuery.run(
      "INSERT INTO outlet_revenues (outlet_id, tanggal, jumlah_omzet, dicatat_oleh) VALUES (?, ?, ?, ?)",
      [outlet_id, tanggal, parseFloat(jumlah_omzet), userId]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Omzet outlet berhasil dicatat.',
      data: { id: result.id, outlet_id, tanggal, jumlah_omzet }
    });
  } catch (error) {
    console.error('createRevenue error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mencatat omzet outlet.'
    });
  }
}

export async function deleteRevenue(req, res) {
  const { id } = req.params;

  try {
    const revenue = await dbQuery.get("SELECT id FROM outlet_revenues WHERE id = ?", [id]);
    if (!revenue) {
      return res.status(404).json({
        status: 'error',
        message: 'Data catatan omzet tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM outlet_revenues WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Catatan omzet berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteRevenue error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus catatan omzet.'
    });
  }
}

export async function updateRevenue(req, res) {
  const { id } = req.params;
  const { outlet_id, tanggal, jumlah_omzet } = req.body;

  if (!outlet_id || !tanggal || jumlah_omzet === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Outlet, tanggal, dan jumlah omzet wajib diisi.'
    });
  }

  try {
    const revenue = await dbQuery.get("SELECT id FROM outlet_revenues WHERE id = ?", [id]);
    if (!revenue) {
      return res.status(404).json({
        status: 'error',
        message: 'Data catatan omzet tidak ditemukan.'
      });
    }

    await dbQuery.run(
      `UPDATE outlet_revenues
       SET outlet_id = ?, tanggal = ?, jumlah_omzet = ?
       WHERE id = ?`,
      [outlet_id, tanggal, parseFloat(jumlah_omzet), id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Catatan omzet berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateRevenue error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui catatan omzet.'
    });
  }
}
