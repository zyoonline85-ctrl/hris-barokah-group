import express from 'express';
import { 
  getOutlets, createOutlet, updateOutlet, deleteOutlet,
  getRevenues, createRevenue, deleteRevenue, updateRevenue 
} from '../controllers/outletController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// === Rute Outlets ===
router.get('/', getOutlets);
router.post('/', checkPermission('outlets', 'edit'), createOutlet);
router.put('/:id', checkPermission('outlets', 'edit'), updateOutlet);
router.delete('/:id', checkPermission('outlets', 'delete'), deleteOutlet);

// === Rute Omzet / Revenues ===
router.get('/revenues', checkPermission('revenues', 'view'), getRevenues);
router.post('/revenues', checkPermission('revenues', 'edit'), createRevenue);
router.put('/revenues/:id', checkPermission('revenues', 'edit'), updateRevenue);
router.delete('/revenues/:id', checkPermission('revenues', 'delete'), deleteRevenue);

export default router;
