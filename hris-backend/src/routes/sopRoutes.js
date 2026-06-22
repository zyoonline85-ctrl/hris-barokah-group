import express from 'express';
import { getSops, createSop, updateSop, deleteSop, generateAiSop, sendSop } from '../controllers/sopController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getSops);
router.post('/', checkPermission('sops', 'edit'), createSop);
router.post('/generate-ai', generateAiSop);
router.put('/:id', checkPermission('sops', 'edit'), updateSop);
router.put('/:id/send', checkPermission('sops', 'edit'), sendSop);
router.delete('/:id', checkPermission('sops', 'delete'), deleteSop);

export default router;
