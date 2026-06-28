import express from 'express';
import {
  getSurveys,
  createSurvey,
  deleteSurvey,
  getSurveyResponses,
  submitSurveyResponse
} from '../controllers/surveyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Routes
router.use(authenticateToken);
router.get('/', getSurveys);
router.post('/', createSurvey);
router.delete('/:id', deleteSurvey);
router.get('/:id/responses', getSurveyResponses);
router.post('/:id/responses', submitSurveyResponse);

export default router;
