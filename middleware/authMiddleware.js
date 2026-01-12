import { collections } from '../config/db.js';
import admin from '../config/firebase.js';

export async function verifyFireBaseToken(req, res, next) {
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

export const verifyAdmin = async (req, res, next) => {
  const email = req.token_email;
  const query = { email };
  const user = await collections.users.findOne(query);

  if (!user || user.role !== 'admin') {
    return res.status(403).send({ message: 'forbidden access' });
  }

  next();
};

export const verifyCreator = async (req, res, next) => {
  const email = req.token_email;
  const query = { email };
  const user = await collections.users.findOne(query);

  if (!user || user.role !== 'creator') {
    return res.status(403).send({ message: 'forbidden access' });
  }

  next();
};

export const verifyAdminOrCreator = async (req, res, next) => {
  const email = req.token_email;
  const query = { email };
  const user = await collections.users.findOne(query);

  if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
    return res.status(403).send({ message: 'forbidden access' });
  }

  next();
};

export const verifyUser = async (req, res, next) => {
  const email = req.token_email;
  const query = { email };
  const user = await collections.users.findOne(query);

  if (!user || user.role !== 'user') {
    return res.status(403).send({ message: 'forbidden access' });
  }

  next();
};

export const verifyAdminOrUser = async (req, res, next) => {
  const email = req.token_email;
  const query = { email };
  const user = await collections.users.findOne(query);

  if (!user || (user.role !== 'admin' && user.role !== 'user')) {
    return res.status(403).send({ message: 'forbidden access' });
  }

  next();
};
