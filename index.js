import cors from 'cors';
import express from 'express';
import admin from 'firebase-admin';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET);

const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  'base64'
).toString('utf8');
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 5000;

// MiddleWare
app.use(cors());
app.use(express.json());

async function verifyFireBaseToken(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      message: 'unauthorized access',
    });
  }
  const token = authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'unauthorized access. Token not found!',
    });
  }

  try {
    const tokenInfo = await admin.auth().verifyIdToken(token);

    // console.log(tokenInfo);
    req.token_email = tokenInfo.email;

    next();
  } catch (error) {
    console.log('Invalid Token');
    console.log(error);
    res.status(401).json({
      message: 'unauthorized access.',
    });
  }
}

// Server Root Route
app.get('/', (req, res) => {
  res.send('<h1>Hello World </h1>');
});

//DB CONFIG
const uri = process.env.DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db('champyDB');
    const userCollection = db.collection('users');
    const contestCollection = db.collection('contests');
    const paymentCollection = db.collection('payments');
    const participateCollection = db.collection('participates');

    // Verify Admin role
    const verifyAdmin = async (req, res, next) => {
      const email = req.token_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }

      next();
    };

    const verifyContentCreator = async (req, res, next) => {
      const email = req.token_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== 'content-creator') {
        return res.status(403).send({ message: 'forbidden access' });
      }

      next();
    };

    //! User APIs
    // get all users
    app.get('/users', async (req, res) => {
      const users = await userCollection.find().toArray();
      res.json(users);
    });

    // change user Role
    app.patch('/users/:id/role', async (req, res) => {
      const { id } = req.params;
      const userInfo = req.body;

      const updateDoc = {
        $set: {
          role: userInfo.role,
        },
      };

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );

      res.json(result);
    });

    // register user into DB
    app.post('/users', async (req, res) => {
      const userInfo = req.body;

      userInfo.role = 'user';
      userInfo.createdAt = new Date();

      const email = userInfo.email;
      const userExist = await userCollection.findOne({ email });

      if (userExist) {
        return res.json({ message: 'user exists' });
      }

      const result = await userCollection.insertOne(userInfo);

      res.json(result);
    });

    //! Contest APIs
    // get all contest list
    // get contest list by specific user
    // get contest list by status
    app.get('/contests', async (req, res) => {
      const { email, status } = req.query;
      const query = {};
      if (email) {
        query.creatorEmail = email;
      }
      if (status) {
        query.contestStatus = status;
      }
      const contests = await contestCollection.find(query).toArray();

      res.json(contests);
    });

    // get specific contest
    app.get('/contests/:id', async (req, res) => {
      const { id } = req.params;
      // console.log(id);

      const contest = await contestCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(contest);
    });

    // create contest
    app.post('/contests', async (req, res) => {
      const contestInfo = req.body;
      contestInfo.createdAt = new Date();

      const result = await contestCollection.insertOne(contestInfo);

      res.json(result);
    });

    // update contest
    app.patch('/contests/:id', async (req, res) => {
      const { id } = req.params;
      const updatedInfo = req.body;

      const updateDoc = {
        $set: updatedInfo,
      };

      const result = await contestCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );

      res.json(result);
    });

    // Delete Contest
    app.delete('/contests/:id', async (req, res) => {
      const { id } = req.params;

      const result = await contestCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    //! Payments APIs
    // get participate payment info
    app.get('/payments', async (req, res) => {
      const { contestId, email } = req.query;
      const query = {};
      if (email) {
        query.customer_email = email;
      }
      if (contestId) {
        query.contestId = contestId;
      }

      console.log(query);

      const paymentInfo = await paymentCollection.findOne(query);

      res.json(paymentInfo);
    });
    // verify payment
    app.get('/payment-success', async (req, res) => {
      const { session_id } = req.query;

      const session = await stripe.checkout.sessions.retrieve(session_id);

      // console.log(session);

      const transactionId = session.payment_intent;

      // Close guard if payment exist
      const isPaymentExist = await paymentCollection.findOne({
        transactionId,
      });

      // console.log(isPaymentExist);

      if (isPaymentExist) {
        return res.json({
          message: 'already exists',
          transactionId,
          contestId,
        });
      }

      if (session.payment_status === 'paid') {
        const contestId = session.metadata.contestId;

        const contestResult = await contestCollection.updateOne(
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

        const paymentResult = await paymentCollection.insertOne(paymentData);

        return res.json({
          success: true,
          modifyContest: contestResult,
          paymentInfo: paymentResult,
          transactionId,
          contestId,
        });
      }

      res.json({ success: false, contestId });
    });

    // get payment cancelled contest
    app.get('/payment-cancelled', async (req, res) => {
      const { session_id } = req.query;

      const session = await stripe.checkout.sessions.retrieve(session_id);

      // console.log(session);

      res.json({ contestId: session.metadata.contestId });
    });

    // create payment session
    app.post('/create-checkout-session', async (req, res) => {
      const { contestId, contestName, contestPrice, participatorEmail } =
        req.body;

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
        },
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled?session_id={CHECKOUT_SESSION_ID}`,
      });

      res.json({ url: session.url });
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
