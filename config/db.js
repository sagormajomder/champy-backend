import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
const collections = {};

async function connectDB() {
  if (db) return db;
  try {
    await client.connect();
    db = client.db('champyDB');
    collections.users = db.collection('users');
    collections.contests = db.collection('contests');
    collections.payments = db.collection('payments');
    collections.participates = db.collection('participates');
    console.log('Connected to MongoDB!');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export { client, collections, connectDB };
