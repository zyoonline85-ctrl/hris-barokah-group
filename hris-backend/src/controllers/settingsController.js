import { dbQuery } from '../config/db.js';

/**
 * Mengambil seluruh pengaturan sistem
 */
export async function getSettings(req, res) {
  try {
    const settings = await dbQuery.all("SELECT key, value, description FROM system_settings");
    return res.status(200).json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    console.error('getSettings error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil pengaturan sistem.'
    });
  }
}

/**
 * Memperbarui pengaturan sistem secara massal
 */
export async function updateSettings(req, res) {
  const { settings } = req.body; // Array of { key, value }

  if (!settings || !Array.isArray(settings)) {
    return res.status(400).json({
      status: 'error',
      message: 'Format data tidak valid. Wajib menyertakan array pengaturan.'
    });
  }

  try {
    await dbQuery.run("BEGIN TRANSACTION");
    try {
      for (const item of settings) {
        const { key, value } = item;
        if (key && value !== undefined) {
          await dbQuery.run(
            "UPDATE system_settings SET value = ? WHERE key = ?",
            [String(value), key]
          );
        }
      }
      await dbQuery.run("COMMIT");
    } catch (loopError) {
      await dbQuery.run("ROLLBACK");
      throw loopError;
    }

    return res.status(200).json({
      status: 'success',
      message: 'Pengaturan sistem berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateSettings error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui pengaturan sistem.'
    });
  }
}

/**
 * Mengambil matriks hak akses seluruh jabatan
 */
export async function getAllPermissions(req, res) {
  try {
    const permissions = await dbQuery.all(
      "SELECT id, position, module, can_view, can_edit, can_delete FROM position_permissions"
    );
    return res.status(200).json({
      status: 'success',
      data: permissions
    });
  } catch (error) {
    console.error('getAllPermissions error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil matriks perizinan.'
    });
  }
}

/**
 * Memperbarui matriks hak akses secara massal
 */
export async function updatePermissions(req, res) {
  const { permissions } = req.body; // Array dari { position, module, can_view, can_edit, can_delete }

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({
      status: 'error',
      message: 'Format data tidak valid. Wajib menyertakan array perizinan.'
    });
  }

  try {
    await dbQuery.run("BEGIN TRANSACTION");
    try {
      for (const item of permissions) {
        const { position, module: mod, can_view, can_edit, can_delete } = item;
        if (position && mod) {
          await dbQuery.run(
            `UPDATE position_permissions 
             SET can_view = ?, can_edit = ?, can_delete = ? 
             WHERE position = ? AND module = ?`,
            [can_view ? 1 : 0, can_edit ? 1 : 0, can_delete ? 1 : 0, position, mod]
          );
        }
      }
      await dbQuery.run("COMMIT");
    } catch (loopError) {
      await dbQuery.run("ROLLBACK");
      throw loopError;
    }

    return res.status(200).json({
      status: 'success',
      message: 'Matriks perizinan berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updatePermissions error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui matriks perizinan.'
    });
  }
}

/**
 * Hard Reset Dasbor & Database (Pembersihan Sampah & Compact)
 */
export async function clearTrash(req, res) {
  try {
    // 1. Bersihkan notifikasi mobile > 7 hari
    const deletedNotifications = await dbQuery.run(
      "DELETE FROM mobile_user_notifications WHERE created_at < datetime('now', '-7 days')"
    );

    // 2. Bersihkan orphan records (data tanpa karyawan terdaftar)
    const orphans = [
      { table: 'attendances', col: 'employee_id' },
      { table: 'leaves', col: 'employee_id' },
      { table: 'payrolls', col: 'employee_id' },
      { table: 'kpis', col: 'employee_id' },
      { table: 'ratings_360', col: 'employee_id' },
      { table: 'sanctions', col: 'employee_id' },
      { table: 'contracts', col: 'employee_id' }
    ];

    let totalOrphansDeleted = 0;
    for (const orphan of orphans) {
      const result = await dbQuery.run(
        `DELETE FROM ${orphan.table} WHERE ${orphan.col} NOT IN (SELECT id FROM employees)`
      );
      totalOrphansDeleted += result.changes || 0;
    }

    // 3. Compact database
    await dbQuery.run("VACUUM");
    await dbQuery.run("PRAGMA wal_checkpoint(TRUNCATE)");

    return res.status(200).json({
      status: 'success',
      message: 'Pembersihan database berhasil dilakukan.',
      data: {
        deleted_notifications: deletedNotifications.changes || 0,
        deleted_orphans: totalOrphansDeleted
      }
    });
  } catch (error) {
    console.error('clearTrash error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal melakukan pembersihan database.'
    });
  }
}

