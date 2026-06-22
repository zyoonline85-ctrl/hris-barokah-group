import express from 'express';
import { generatePayroll, getAllPayrolls, updatePaymentStatus, updatePayroll, deletePayroll, sendPayrollSlip } from '../controllers/payrollController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Wajib Login
router.use(authenticateToken);

// Mengakses slip gaji (karyawan melihat miliknya, Owner/Admin/Leader melihat semuanya)
router.get('/', getAllPayrolls);

// Hanya yang memiliki hak akses payroll-edit/delete yang bisa meng-generate, membayar, mengubah, dan menghapus
router.post('/generate', checkPermission('payroll', 'edit'), generatePayroll);
router.put('/:id/pay', checkPermission('payroll', 'edit'), updatePaymentStatus);
router.put('/:id/send', checkPermission('payroll', 'edit'), sendPayrollSlip);
router.put('/:id', checkPermission('payroll', 'edit'), updatePayroll);
router.delete('/:id', checkPermission('payroll', 'delete'), deletePayroll);

export default router;

