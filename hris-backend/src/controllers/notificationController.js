import { dbQuery } from '../config/db.js';

export async function getNotifications(req, res) {
  try {
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({
        status: 'error',
        message: 'Akses ditolak: ID Karyawan tidak teridentifikasi.'
      });
    }

    const notifications = await dbQuery.all(
      `SELECT * FROM mobile_user_notifications
       WHERE employee_id = ?
       ORDER BY created_at DESC`,
      [employeeId]
    );

    return res.status(200).json({
      status: 'success',
      data: notifications
    });
  } catch (error) {
    console.error('getNotifications error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data notifikasi.'
    });
  }
}

export async function markNotificationRead(req, res) {
  const { id } = req.params;
  const employeeId = req.user.employeeId;

  if (!employeeId) {
    return res.status(400).json({
      status: 'error',
      message: 'Akses ditolak: ID Karyawan tidak teridentifikasi.'
    });
  }

  try {
    const notif = await dbQuery.get(
      "SELECT id FROM mobile_user_notifications WHERE id = ? AND employee_id = ?",
      [id, employeeId]
    );

    if (!notif) {
      return res.status(404).json({
        status: 'error',
        message: 'Notifikasi tidak ditemukan.'
      });
    }

    await dbQuery.run(
      "UPDATE mobile_user_notifications SET is_read = 1 WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Notifikasi berhasil ditandai sebagai dibaca.'
    });
  } catch (error) {
    console.error('markNotificationRead error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menandai notifikasi dibaca.'
    });
  }
}
