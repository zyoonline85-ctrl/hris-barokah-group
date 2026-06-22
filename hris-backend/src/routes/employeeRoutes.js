import express from 'express';
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deactivateEmployee, getMyOutletColleagues } from '../controllers/employeeController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Semua rute di bawah ini wajib login (authenticateToken)
router.use(authenticateToken);

// Menggunakan checkPermission dinamis
router.get('/', checkPermission('employees', 'view'), getAllEmployees);
router.post('/', checkPermission('employees', 'edit'), createEmployee);

// Mengambil rekan kerja satu outlet
router.get('/my-outlet', getMyOutletColleagues);

// Mengambil profil tunggal dan update profil (Karyawan bersangkutan atau Owner/Admin/Role berizin)
router.get('/:id', getEmployeeById);
router.put('/:id', updateEmployee);

// Menonaktifkan karyawan
router.delete('/:id', checkPermission('employees', 'delete'), deactivateEmployee);

export default router;
