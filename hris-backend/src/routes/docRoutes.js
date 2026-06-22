import express from 'express';
import { 
  getDocumentations, 
  createDocumentation, 
  updateDocumentation, 
  deleteDocumentation,
  toggleDocumentationStatus,
  serveDocumentationFile,
  previewDocumentation,
  sendDocumentation
} from '../controllers/docController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// Endpoint CRUD utama & list
router.get('/', getDocumentations);
router.post('/', checkPermission('policies', 'edit'), createDocumentation);
router.put('/:id', checkPermission('policies', 'edit'), updateDocumentation);
router.delete('/:id', checkPermission('policies', 'delete'), deleteDocumentation);

// Endpoint status toggle & preview/download file
router.put('/:id/toggle', checkPermission('policies', 'edit'), toggleDocumentationStatus);
router.put('/:id/send', checkPermission('policies', 'edit'), sendDocumentation);
router.get('/:id/preview', previewDocumentation);
router.get('/file/:filename', serveDocumentationFile);

export default router;
