import express from 'express';
import {
  addSubmittedTaskInfo,
  addWinnerParticipate,
  getParticipatorContestStats,
  getSpecificParticipate,
  getSubmissionsOrWinner,
} from '../controllers/participate.controller.js';
import {
  verifyCreator,
  verifyFireBaseToken,
  verifyUser,
} from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/participates/:contestId/:email', getSpecificParticipate);
router.get('/participates/:contestId', getSubmissionsOrWinner);
router.get(
  '/participates/contest/winning/stats/:email',
  verifyFireBaseToken,
  verifyUser,
  getParticipatorContestStats,
);
router.patch(
  '/participates/:id',
  verifyFireBaseToken,
  verifyCreator,
  addWinnerParticipate,
);
router.patch(
  '/participates/:contestId/:email',
  verifyFireBaseToken,
  verifyUser,
  addSubmittedTaskInfo,
);

export default router;
