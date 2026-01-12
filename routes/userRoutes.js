import express from 'express';
import {
  changeUserRole,
  getAllUsers,
  getLeaderboard,
  getUserRole,
  registerUser,
  updateUser,
} from '../controllers/userController.js';
import {
  verifyAdmin,
  verifyFireBaseToken,
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/users', verifyFireBaseToken, getAllUsers);
router.get('/users/:email/role', verifyFireBaseToken, getUserRole);
router.patch(
  '/users/:id/role',
  verifyFireBaseToken,
  verifyAdmin,
  changeUserRole
);
router.patch('/users/:id', verifyFireBaseToken, updateUser);
router.post('/users', registerUser);
router.get('/leaderboard', getLeaderboard);

export default router;
