import express from 'express';
import {
  createCheckoutSession,
  paymentCancelled,
  paymentSuccess,
} from '../controllers/payment.controller.js';
import {
  verifyFireBaseToken,
  verifyUser,
} from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/payment-success', verifyFireBaseToken, paymentSuccess);
router.get('/payment-cancelled', verifyFireBaseToken, paymentCancelled);
router.post(
  '/create-checkout-session',
  verifyFireBaseToken,
  verifyUser,
  createCheckoutSession,
);

export default router;
