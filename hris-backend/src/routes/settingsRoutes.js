import express from 'express';
import { getSettings, updateSettings, getAllPermissions, updatePermissions, clearTrash } from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// Karyawan butuh membaca lokasi & radius geofence Absensi
router.get('/', getSettings);

// Hanya yang memiliki hak akses settings-edit yang bisa mengubah konfigurasi sistem/pengaturan global
router.put('/', checkPermission('settings', 'edit'), updateSettings);

// Endpoint matriks hak akses jabatan
router.get('/permissions', checkPermission('settings', 'view'), getAllPermissions);
router.put('/permissions', checkPermission('settings', 'edit'), updatePermissions);

// Pembersihan database / Hard reset dasbor
router.post('/clear-trash', checkPermission('settings', 'edit'), clearTrash);

export default router;
