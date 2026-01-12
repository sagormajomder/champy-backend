import { ObjectId } from 'mongodb';
import { collections } from '../config/db.js';

export const getAllUsers = async (req, res) => {
  const { email, limit = 0, skip = 0 } = req.query;

  if (email) {
    if (email !== req.token_email) {
      return res.status(403).json({ message: 'forbidden access' });
    }
    const user = await collections.users.findOne({ email });
    return res.json(user);
  }

  const users = await collections.users
    .find()
    .limit(Number(limit))
    .skip(Number(skip))
    .toArray();

  const totalUsersCount = await collections.users.countDocuments();

  res.json({ users, totalUsersCount });
};

export const getUserRole = async (req, res) => {
  const email = req.params.email;
  const query = { email };

  if (email) {
    if (email !== req.token_email) {
      return res.status(403).json({ message: 'forbidden access' });
    }
  }

  const user = await collections.users.findOne(query);
  res.send({ role: user?.role || 'user' });
};

export const changeUserRole = async (req, res) => {
  const { id } = req.params;
  const userInfo = req.body;

  const updateDoc = {
    $set: {
      role: userInfo.role,
    },
  };

  const result = await collections.users.updateOne(
    { _id: new ObjectId(id) },
    updateDoc
  );

  res.json(result);
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { email } = req.query;
  const updateInfo = req.body;

  const update = {
    $set: updateInfo,
  };
  const result = await collections.users.updateOne(
    { _id: new ObjectId(id) },
    update
  );

  if (email) {
    const participatorUpdateResult = await collections.participates.updateMany(
      { participatorEmail: email },
      {
        $set: {
          participatorPhotoURL: updateInfo.photoURL,
        },
      }
    );
  }

  res.json(result);
};

export const registerUser = async (req, res) => {
  const userInfo = req.body;

  userInfo.role = 'user';
  userInfo.createdAt = new Date();

  const email = userInfo.email;
  const userExist = await collections.users.findOne({ email });

  if (userExist) {
    return res.json({ message: 'user exists' });
  }

  const result = await collections.users.insertOne(userInfo);

  res.json(result);
};

export const getLeaderboard = async (req, res) => {
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

  const leaderboard = await collections.participates
    .aggregate(pipeline)
    .toArray();

  res.json(leaderboard);
};
