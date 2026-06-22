import express from 'express';
import { requestLeave, getAllLeaves, approveRejectLeave, updateLeave, deleteLeave, sendLeaveNotification } from '../controllers/leaveController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Wajib Login
router.use(authenticateToken);

// Karyawan mengajukan cuti & semua user mengambil daftar cuti sesuai wewenang
router.post('/', requestLeave);
router.get('/', getAllLeaves);

router.put('/:id', checkPermission('leaves', 'edit'), updateLeave);
router.delete('/:id', checkPermission('leaves', 'delete'), deleteLeave);

// Hanya yang memiliki hak akses edit leaves (Owner/Admin/Leader) yang bisa memproses persetujuan pengajuan cuti
router.put('/:id/approve', checkPermission('leaves', 'edit'), approveRejectLeave);
router.put('/:id/send', checkPermission('leaves', 'edit'), sendLeaveNotification);

export default router;
