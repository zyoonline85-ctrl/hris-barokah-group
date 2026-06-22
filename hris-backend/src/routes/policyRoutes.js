import express from 'express';
import { 
  getPolicies, createPolicy, updatePolicy, deletePolicy, syncPolicies,
  getPeakDays, createPeakDay, deletePeakDay, syncPeakDays
} from '../controllers/policyController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getPolicies);
router.post('/sync', syncPolicies);
router.post('/', checkPermission('policies', 'edit'), createPolicy);
router.put('/:id', checkPermission('policies', 'edit'), updatePolicy);
router.delete('/:id', checkPermission('policies', 'delete'), deletePolicy);

// Peak Day Routes
router.get('/peak-days', getPeakDays);
router.post('/peak-days/sync', syncPeakDays);
router.post('/peak-days', checkPermission('policies', 'edit'), createPeakDay);
router.delete('/peak-days/:id', checkPermission('policies', 'delete'), deletePeakDay);

export default router;
