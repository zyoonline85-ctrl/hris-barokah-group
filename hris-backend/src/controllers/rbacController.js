import { dbQuery } from '../config/db.js';

/**
 * Mengambil matriks hak akses (RBAC) seluruh peran
 */
export async function getRbacPermissions(req, res) {
  try {
    const permissions = await dbQuery.all("SELECT id, role, permission_key, is_allowed FROM rbac_permissions");
    return res.status(200).json({
      status: 'success',
      data: permissions
    });
  } catch (error) {
    console.error('getRbacPermissions error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data hak akses (RBAC).'
    });
  }
}

/**
 * Memperbarui wewenang/hak akses untuk key tertentu
 */
export async function updateRbacPermission(req, res) {
  const { role, permission_key, is_allowed } = req.body;

  if (!role || !permission_key || is_allowed === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Parameter tidak lengkap. Wajib menyertakan role, permission_key, dan is_allowed.'
    });
  }

  try {
    await dbQuery.run(
      `INSERT INTO rbac_permissions (role, permission_key, is_allowed)
       VALUES (?, ?, ?)
       ON CONFLICT(role, permission_key) DO UPDATE SET is_allowed = excluded.is_allowed`,
      [role, permission_key, is_allowed ? 1 : 0]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Hak akses RBAC berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateRbacPermission error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui hak akses RBAC.'
    });
  }
}
