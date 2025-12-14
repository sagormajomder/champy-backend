import cors from 'cors';
import express from 'express';
import admin from 'firebase-admin';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';

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
    // get contest list created by specific creator
    app.get('/contests', async (req, res) => {
      const { email } = req.query;
      const query = {};
      if (email) {
        query.creatorEmail = email;
      }
      const contests = await contestCollection.find(query).toArray();

      res.json(contests);
    });

    // get specific contest
    app.get('/contests/:id', async (req, res) => {
      const { id } = req.params;
      console.log(id);

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

    // delete specific contest
    app.delete('/contests/:id', async (req, res) => {
      const { id } = req.params;

      const result = await contestCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
