import express from 'express';
import { getSanctions, createSanction, updateSanctionStatus, deleteSanction, updateSanction, getEmployeesForSanction } from '../controllers/sanctionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// Daftar karyawan aktif untuk keperluan form sanksi (tidak perlu izin employees)
router.get('/employees', getEmployeesForSanction);

router.get('/', getSanctions);
router.post('/', checkPermission('sanctions', 'edit'), createSanction);
router.put('/:id', checkPermission('sanctions', 'edit'), updateSanction);
router.put('/:id/status', checkPermission('sanctions', 'edit'), updateSanctionStatus);
router.delete('/:id', checkPermission('sanctions', 'delete'), deleteSanction);

export default router;
