import express from 'express';
import {
  createContest,
  deleteContest,
  getAllContests,
  getContestById,
  getContestsBySearch,
  getParticipatorContestsByPaidStatus,
  getWinnerParticipatorContests,
  updateContest,
} from '../controllers/contestController.js';
import {
  verifyAdminOrCreator,
  verifyCreator,
  verifyFireBaseToken,
  verifyUser,
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/contests', getAllContests);
router.get('/contests/search', getContestsBySearch);
router.get(
  '/contests/winner-participator',
  verifyFireBaseToken,
  verifyUser,
  getWinnerParticipatorContests
);
router.get(
  '/contests/participate',
  verifyFireBaseToken,
  verifyUser,
  getParticipatorContestsByPaidStatus
);
router.get('/contests/:id', getContestById);
router.post('/contests', verifyFireBaseToken, verifyCreator, createContest);
router.patch(
  '/contests/:id',
  verifyFireBaseToken,
  verifyAdminOrCreator,
  updateContest
);
router.delete(
  '/contests/:id',
  verifyFireBaseToken,
  verifyAdminOrCreator,
  deleteContest
);

export default router;
