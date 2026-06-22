import express from 'express';
import { requestLeave } from '../controllers/leaveController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Wajib Login
router.use(authenticateToken);

// Karyawan mengajukan cuti/izin/kasbon
router.post('/submit', requestLeave);

export default router;
