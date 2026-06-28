import express from 'express';
import { 
  getInformations, 
  markInformationRead,
  generateMotivation,
  updateMotivation
} from '../controllers/informationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getInformations);
router.post('/generate-motivation', generateMotivation);
router.post('/daily-motivation', updateMotivation);
router.post('/:id/read', markInformationRead);

export default router;
