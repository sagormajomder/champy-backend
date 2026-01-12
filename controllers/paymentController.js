import { ObjectId } from 'mongodb';
import crypto from 'node:crypto';
import { collections } from '../config/db.js';
import stripe from '../config/stripe.js';

function generateTransactionId() {
  const prefix = 'pi'; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const random = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char random hex

  return `${prefix}_${date}${random}`;
}

export const paymentSuccess = async (req, res) => {
  const { session_id } = req.query;

  const session = await stripe.checkout.sessions.retrieve(session_id);

  // console.log(session);

  const transactionId = session.payment_intent ?? generateTransactionId();

  // Close guard if payment exist
  const isPaymentExist = await collections.payments.findOne({
    transactionId,
  });

  // console.log(isPaymentExist);

  if (isPaymentExist) {
    return res.json({
      message: 'already exists',
      transactionId,
      contestId: session.metadata.contestId, // Assuming metadata is available in session
    });
  }

  if (session.payment_status === 'paid') {
    const contestId = session.metadata.contestId;

    const contestResult = await collections.contests.updateOne(
      {
        _id: new ObjectId(contestId),
      },
      { $inc: { participatedCount: 1 } }
    );

    const paymentData = {
      amount: session.amount_total / 100,
      currency: session.currency,
      customer_email: session.customer_email,
      contestId,
      transactionId,
      paymentStatus: session.payment_status,
      paidAt: new Date(),
    };

    const paymentResult = await collections.payments.insertOne(paymentData);

    const participateData = {
      contestId,
      contestDeadline: session.metadata.contestDeadline,
      participatorName: session.metadata.participatorName,
      participatorEmail: session.customer_email,
      participatorPhotoURL: session.metadata.participatorPhotoURL,
      createdAt: new Date(),
    };

    const participateResult = await collections.participates.insertOne(
      participateData
    );

    return res.json({
      success: true,
      modifyContest: contestResult,
      paymentInfo: paymentResult,
      participateInfo: participateResult,
      transactionId,
      contestId,
    });
  }

  res.json({ success: false, contestId: session.metadata.contestId });
};

export const paymentCancelled = async (req, res) => {
  const { session_id } = req.query;

  const session = await stripe.checkout.sessions.retrieve(session_id);

  // console.log(session);

  res.json({ contestId: session.metadata.contestId });
};

export const createCheckoutSession = async (req, res) => {
  const {
    contestId,
    contestName,
    contestDeadline,
    contestPrice,
    participatorName,
    participatorEmail,
    participatorPhotoURL,
  } = req.body;

  const amount = parseInt(contestPrice) * 100;

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'bdt',
          product_data: {
            name: `Please pay fee for the contest named "${contestName}"`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer_email: participatorEmail,
    metadata: {
      contestId,
      contestName,
      participatorName,
      participatorEmail,
      participatorPhotoURL,
      contestDeadline,
    },
    success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled?session_id={CHECKOUT_SESSION_ID}`,
  });

  res.json({ url: session.url });
};
