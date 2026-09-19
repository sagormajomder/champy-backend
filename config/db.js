import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.DB_URI;

let client = null;
let db = null;
export const collections = {};

export function getClient() {
  if (!client) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 5,
    });
  }
  return client;
}

export function getDB(dbName = 'champyDB') {
  if (!db) {
    db = getClient().db(dbName);
  }
  return db;
}

export async function connectDB() {
  try {
    await getClient().connect();
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
}

collections.users = getDB().collection('users');
collections.contests = getDB().collection('contests');
collections.payments = getDB().collection('payments');
collections.participates = getDB().collection('participates');

export async function closeDB() {
  if (client) {
    try {
      await client.close();
      console.log('MongoDB connection closed cleanly.');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    } finally {
      client = null;
      db = null;
    }
  }
}
