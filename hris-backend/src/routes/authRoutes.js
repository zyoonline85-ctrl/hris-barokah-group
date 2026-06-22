import express from 'express';
import { login, getMe, getMyPermissions, syncCredentials } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Autentikasi Publik
router.post('/login', login);
router.post('/sync-credentials', syncCredentials);

// Keamanan Private Profil
router.get('/me', authenticateToken, getMe);
router.get('/my-permissions', authenticateToken, getMyPermissions);

export default router;
