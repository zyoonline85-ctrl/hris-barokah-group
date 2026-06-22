import express from 'express';
import { 
  clockIn, 
  clockOut, 
  getTodayAttendance, 
  getAttendanceHistory,
  breakStart,
  breakEnd,
  getBreakSchedule,
  syncBreakSchedule
} from '../controllers/attendanceController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Semua rute absensi membutuhkan autentikasi karyawan/admin
router.use(authenticateToken);

router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.get('/today', getTodayAttendance);
router.get('/history', getAttendanceHistory);

// Rute untuk break tracking & scheduling
router.post('/break-start', breakStart);
router.post('/break-end', breakEnd);
router.get('/break-schedule', getBreakSchedule);
router.post('/break-schedule/sync', syncBreakSchedule);

export default router;
