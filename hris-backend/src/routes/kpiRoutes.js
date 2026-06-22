import express from 'express';
import { getKpis, createOrUpdateKpi, deleteKpi, get360Ratings, create360Rating } from '../controllers/kpiController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getKpis);
router.post('/', checkPermission('kpis', 'edit'), createOrUpdateKpi);
router.delete('/:id', checkPermission('kpis', 'delete'), deleteKpi);

// Rute Penilaian 360° Anonim
router.get('/360-ratings', get360Ratings);
router.post('/360-ratings', create360Rating);

export default router;
