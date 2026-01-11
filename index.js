import cors from 'cors';
import express from 'express';
import admin from 'firebase-admin';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import crypto from 'node:crypto';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET);

const app = express();
const port = process.env.PORT || 5000;

function generateTransactionId() {
  const prefix = 'pi'; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const random = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char random hex

  return `${prefix}_${date}${random}`;
}

const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  'base64'
).toString('utf8');
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

    const verifyCreator = async (req, res, next) => {
      const email = req.token_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== 'creator') {
        return res.status(403).send({ message: 'forbidden access' });
      }

      next();
    };

    // Verify Admin or Creator role
    const verifyAdminOrCreator = async (req, res, next) => {
      const email = req.token_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      next();
    };

    // Verify User role
    const verifyUser = async (req, res, next) => {
      const email = req.token_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== 'user') {
        return res.status(403).send({ message: 'forbidden access' });
      }

      next();
    };

    //! User APIs
    // get all users
    // JWT DONE
    app.get('/users', verifyFireBaseToken, async (req, res) => {
      const { email, limit = 0, skip = 0 } = req.query;

      if (email) {
        if (email !== req.token_email) {
          return res.status(403).json({ message: 'forbidden access' });
        }
        const user = await userCollection.findOne({ email });
        return res.json(user);
      }

      const users = await userCollection
        .find()
        .limit(Number(limit))
        .skip(Number(skip))
        .toArray();

      const totalUsersCount = await userCollection.countDocuments();

      res.json({ users, totalUsersCount });
    });

    // get user role
    // Public Route
    app.get('/users/:email/role', verifyFireBaseToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };

      if (email) {
        if (email !== req.token_email) {
          return res.status(403).json({ message: 'forbidden access' });
        }
      }

      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || 'user' });
    });

    // change user Role
    // JWT DONE
    app.patch(
      '/users/:id/role',
      verifyFireBaseToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    // update specific User
    // JWT DONE
    app.patch(
      '/users/:id',
      verifyFireBaseToken,
      verifyUser,
      async (req, res) => {
        const { id } = req.params;

        const { email } = req.query;

        const updateInfo = req.body;

        const update = {
          $set: updateInfo,
        };
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          update
        );

        if (email) {
          const participatorUpdateResult =
            await participateCollection.updateMany(
              { participatorEmail: email },
              {
                $set: {
                  participatorPhotoURL: updateInfo.photoURL,
                },
              }
            );
        }

        res.json(result);
      }
    );

    // register user into DB
    // Public Route
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

    // get leaderboard data
    // Public Route
    app.get('/leaderboard', async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: '$participatorEmail',
            name: { $first: '$participatorName' },
            image: { $first: '$participatorPhotoURL' },
            winCount: {
              $sum: {
                $cond: [{ $eq: ['$winner', true] }, 1, 0],
              },
            },
            participationCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'email',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            _id: '$user._id',
            name: 1,
            image: 1,
            email: '$_id',
            winCount: 1,
            participationCount: 1,
          },
        },
        {
          $sort: {
            winCount: -1,
          },
        },
      ];

      const leaderboard = await participateCollection
        .aggregate(pipeline)
        .toArray();

      res.json(leaderboard);
    });

    //! Contest APIs
    // get all contest list
    // get contest list by specific creator
    // get contest list by status
    // PUBLIC ROUTE
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

    // get contests by search
    // Public Route
    app.get('/contests/search', async (req, res) => {
      const { searchText } = req.query;

      const query = {};

      query.$or = [
        { contestName: { $regex: searchText, $options: 'i' } },
        { contestDesc: { $regex: searchText, $options: 'i' } },
        { contestType: { $regex: searchText, $options: 'i' } },
      ];

      const contests = await contestCollection.find(query).toArray();

      res.json(contests);
    });

    // get winner participator contests
    // JWT DONE
    app.get(
      '/contests/winner-participator',
      verifyFireBaseToken,
      verifyUser,
      async (req, res) => {
        const { email } = req.query;

        const participates = await participateCollection
          .find({ participatorEmail: email, winner: true })
          .toArray();

        const contestIds = participates.map(
          participate => participate.contestId
        );
        const contests = await contestCollection
          .find({ _id: { $in: contestIds.map(id => new ObjectId(id)) } })
          .toArray();

        return res.json(contests);
      }
    );

    // get participator contests by paid status
    // JWT DONE
    app.get(
      '/contests/participate',
      verifyFireBaseToken,
      verifyUser,
      async (req, res) => {
        const { paymentStatus, email } = req.query;
        const query = {};
        if (email) {
          query.customer_email = email;
        }

        if (paymentStatus) {
          query.paymentStatus = paymentStatus;
        }

        // console.log(query);

        const payments = await paymentCollection.find(query).toArray();

        const isPaid = payments.every(pay => pay.paymentStatus === 'paid');

        if (isPaid) {
          const contestIds = payments.map(pay => pay.contestId);
          const transactionIds = payments.map(pay => pay.transactionId);

          const contests = await contestCollection
            .find({ _id: { $in: contestIds.map(id => new ObjectId(id)) } })
            .sort({ contestDeadline: 1 })
            .toArray();

          return res.json({
            paymentStatus: 'paid',
            contests,
            transactionIds,
          });
        }

        res.json({
          success: false,
        });
      }
    );

    // get specific contest
    // JWT DONE
    app.get('/contests/:id', async (req, res) => {
      const { id } = req.params;
      // console.log(id);

      const contest = await contestCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(contest);
    });

    // create contest
    // JWT DONE
    app.post(
      '/contests',
      verifyFireBaseToken,
      verifyCreator,
      async (req, res) => {
        const contestInfo = req.body;
        contestInfo.createdAt = new Date();

        const result = await contestCollection.insertOne(contestInfo);

        res.json(result);
      }
    );

    // update contest
    // JWT DONE
    app.patch(
      '/contests/:id',
      verifyFireBaseToken,
      verifyAdminOrCreator,
      async (req, res) => {
        const { id } = req.params;
        const updatedInfo = req.body;
        // console.log(updatedInfo);

        const updateDoc = {
          $set: updatedInfo,
        };

        const result = await contestCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        // update participate contestDeadline
        const contestDeadline = updatedInfo.contestDeadline;
        // console.log(contestDeadline);
        const participateResult = await participateCollection.updateMany(
          { contestId: id },
          {
            $set: {
              contestDeadline,
            },
          }
        );

        res.json(result);
      }
    );

    // Delete Contest
    // JWT DONE
    app.delete(
      '/contests/:id',
      verifyFireBaseToken,
      verifyAdminOrCreator,
      async (req, res) => {
        const { id } = req.params;

        const result = await contestCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.json(result);
      }
    );

    //! Payments APIs
    // verify payment
    app.get('/payment-success', verifyFireBaseToken, async (req, res) => {
      const { session_id } = req.query;

      const session = await stripe.checkout.sessions.retrieve(session_id);

      // console.log(session);

      const transactionId = session.payment_intent ?? generateTransactionId();

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

        const participateData = {
          contestId,
          contestDeadline: session.metadata.contestDeadline,
          participatorName: session.metadata.participatorName,
          participatorEmail: session.customer_email,
          participatorPhotoURL: session.metadata.participatorPhotoURL,
          createdAt: new Date(),
        };

        const participateResult = await participateCollection.insertOne(
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

      res.json({ success: false, contestId });
    });

    // get payment cancelled contest
    app.get('/payment-cancelled', verifyFireBaseToken, async (req, res) => {
      const { session_id } = req.query;

      const session = await stripe.checkout.sessions.retrieve(session_id);

      // console.log(session);

      res.json({ contestId: session.metadata.contestId });
    });

    // create payment session
    app.post(
      '/create-checkout-session',
      verifyFireBaseToken,
      verifyUser,
      async (req, res) => {
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
      }
    );

    //! Participate APIs

    // get specific participate
    // PUBLIC ROUTE
    app.get('/participates/:contestId/:email', async (req, res) => {
      const { contestId, email } = req.params;
      const query = {};
      if (email) {
        query.participatorEmail = email;
      }
      if (contestId) {
        query.contestId = contestId;
      }

      // console.log(query);

      const participatorInfo = await participateCollection.findOne(query);

      res.json(participatorInfo);
    });

    // get all submission for specific contest
    // get winner participate for specific contest
    // PUBLIC ROUTE
    app.get('/participates/:contestId', async (req, res) => {
      const { contestId } = req.params;

      const { winner } = req.query;

      // console.log(winner);

      if (winner) {
        const winnerParticipator = await participateCollection.findOne({
          contestId,
          winner: !!winner,
        });

        // console.log(winnerParticipator);

        return res.json(winnerParticipator);
      }

      const submissions = await participateCollection
        .find({ contestId, submittedTask: { $exists: true } })
        .toArray();

      res.json(submissions);
    });

    // get participator contest states
    // JWT DONE
    app.get(
      '/participates/contest/winning/stats/:email',
      verifyFireBaseToken,
      verifyUser,
      async (req, res) => {
        const { email } = req.params;

        const pipeline = [
          {
            $match: {
              participatorEmail: email,
            },
          },
          {
            $group: {
              _id: null,
              totalContestParticipate: { $sum: 1 },
              totalContestWon: {
                $sum: {
                  $cond: [{ $eq: ['$winner', true] }, 1, 0],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalContestWon: 1,
              totalContestParticipate: 1,
            },
          },
        ];

        const stats = await participateCollection.aggregate(pipeline).toArray();

        // console.log(stats);

        if (stats.length === 0) {
          return res.json({
            totalContestWon: 0,
            totalContestParticipate: 0,
          });
        }

        res.json(stats);
      }
    );

    // add winner participate
    // JWT DONE
    app.patch(
      '/participates/:id',
      verifyFireBaseToken,
      verifyCreator,
      async (req, res) => {
        const { id } = req.params;
        const { contestId } = req.query;
        const updateWinner = req.body;

        const result = await participateCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: updateWinner,
          }
        );

        const updateLoserResult = await participateCollection.updateMany(
          {
            contestId,
            winner: { $exists: false },
          },
          {
            $set: {
              loser: true,
            },
          }
        );

        res.json(result);
      }
    );

    // add submitted task info into db
    // JWT DONE
    app.patch(
      '/participates/:contestId/:email',
      verifyFireBaseToken,
      verifyUser,
      async (req, res) => {
        const submissionInfo = req.body;
        const { contestId, email } = req.params;

        const query = {};
        if (email) {
          query.participatorEmail = email;
        }
        if (contestId) {
          query.contestId = contestId;
        }

        const contestResult = await contestCollection.updateOne(
          { _id: new ObjectId(contestId) },
          { $inc: { submissionCount: 1 } }
        );

        const updateParticipate = {
          $set: {
            submittedTask: submissionInfo.submittedTask,
          },
        };

        const result = await participateCollection.updateOne(
          query,
          updateParticipate
        );

        res.json(result);
      }
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
