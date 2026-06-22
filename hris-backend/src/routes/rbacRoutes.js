import express from 'express';
import { getRbacPermissions, updateRbacPermission } from '../controllers/rbacController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles(['owner'])); // Hanya owner yang boleh mengurus RBAC

router.get('/', getRbacPermissions);
router.put('/', updateRbacPermission);

export default router;
