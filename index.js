import cors from 'cors';
import express from 'express';
import admin from 'firebase-admin';
import { MongoClient, ServerApiVersion } from 'mongodb';

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
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
