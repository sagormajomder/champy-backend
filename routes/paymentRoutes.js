import express from 'express';
import {
  createCheckoutSession,
  paymentCancelled,
  paymentSuccess,
} from '../controllers/paymentController.js';
import {
  verifyFireBaseToken,
  verifyUser,
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/payment-success', verifyFireBaseToken, paymentSuccess);
router.get('/payment-cancelled', verifyFireBaseToken, paymentCancelled);
router.post(
  '/create-checkout-session',
  verifyFireBaseToken,
  verifyUser,
  createCheckoutSession
);

export default router;
