import { dbQuery } from '../config/db.js';

/**
 * Memetakan string jabatan (position) ke peran dasar hak akses
 * @param {string} position 
 * @returns {string} 'master' | 'leader' | 'admin' | 'user'
 */
export function mapPositionToRole(position) {
  if (!position) return 'user';
  const pos = position.toLowerCase();
  if (pos.includes('owner') || pos.includes('master') || pos.includes('chief') || pos.includes('ceo')) return 'master';
  if (pos.includes('leader') || pos.includes('kepala') || pos.includes('spv') || pos.includes('supervisor')) return 'leader';
  if (pos.includes('admin') || pos.includes('hr') || pos.includes('staff admin') || pos.includes('human resources') || pos.includes('personalia')) return 'admin';
  return 'user';
}

/**
 * Middleware untuk memeriksa hak akses dinamis per modul
 * @param {string} module - Nama modul (misal: 'employees', 'payroll', dll.)
 * @param {string} action - Jenis tindakan ('view' | 'edit' | 'delete')
 */
export function checkPermission(module, action) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Membutuhkan autentikasi.'
      });
    }

    // Akun Owner (Direktur Utama) selalu memiliki akses penuh tanpa kecuali
    if (req.user.role === 'owner') {
      return next();
    }

    const role = mapPositionToRole(req.user.position);
    
    try {
      // Ambil perizinan dari database
      const permission = await dbQuery.get(
        "SELECT can_view, can_edit, can_delete FROM position_permissions WHERE position = ? AND module = ?",
        [role, module]
      );

      if (!permission) {
        // Fail-close: Tolak akses jika konfigurasi perizinan tidak ditemukan
        return res.status(403).json({
          status: 'error',
          message: `Akses ditolak: Konfigurasi hak akses '${role}' untuk modul '${module}' tidak ditemukan.`
        });
      }

      let isAllowed = false;
      if (action === 'view') {
        isAllowed = permission.can_view === 1;
      } else if (action === 'edit') {
        isAllowed = permission.can_edit === 1;
      } else if (action === 'delete') {
        isAllowed = permission.can_delete === 1;
      }

      if (!isAllowed) {
        return res.status(403).json({
          status: 'error',
          message: `Akses ditolak: Anda tidak memiliki wewenang (${action}) pada modul '${module}'.`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Eror sistem: Gagal memeriksa hak akses.'
      });
    }
  };
}
