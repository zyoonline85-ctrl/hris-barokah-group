import express from 'express';
import { getNotifications, markNotificationRead } from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getNotifications);
router.post('/:id/read', markNotificationRead);

export default router;
