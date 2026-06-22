import express from 'express';
import { getTrainings, createTraining, updateTraining, deleteTraining } from '../controllers/trainingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTrainings);
router.post('/', checkPermission('trainings', 'edit'), createTraining);
router.put('/:id', checkPermission('trainings', 'edit'), updateTraining);
router.delete('/:id', checkPermission('trainings', 'delete'), deleteTraining);

export default router;
