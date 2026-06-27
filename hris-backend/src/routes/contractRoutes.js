import express from 'express';
import { 
  getContracts, 
  createContract, 
  signContract, 
  getContractPdf,
  deleteContract
} from '../controllers/contractController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getContracts);
router.post('/', createContract);
router.post('/:id/sign', signContract);
router.get('/:id/pdf', getContractPdf);
router.delete('/:id', deleteContract);

export default router;
