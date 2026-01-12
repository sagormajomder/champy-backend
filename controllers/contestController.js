import { ObjectId } from 'mongodb';
import { collections } from '../config/db.js';

export const getAllContests = async (req, res) => {
  const { email, status, search } = req.query;

  const query = {};
  if (email) {
    query.creatorEmail = email;
  }
  if (status) {
    query.contestStatus = status;
  }
  if (search) {
    query.$or = [
      { contestName: { $regex: search, $options: 'i' } },
      { contestDesc: { $regex: search, $options: 'i' } },
      { contestType: { $regex: search, $options: 'i' } },
    ];
  }
  const contests = await collections.contests.find(query).toArray();

  res.json(contests);
};

export const getContestsBySearch = async (req, res) => {
  const { searchText } = req.query;

  const query = {};

  query.$or = [
    { contestName: { $regex: searchText, $options: 'i' } },
    { contestDesc: { $regex: searchText, $options: 'i' } },
    { contestType: { $regex: searchText, $options: 'i' } },
  ];

  const contests = await collections.contests.find(query).toArray();

  res.json(contests);
};

export const getWinnerParticipatorContests = async (req, res) => {
  const { email } = req.query;

  const participates = await collections.participates
    .find({ participatorEmail: email, winner: true })
    .toArray();

  const contestIds = participates.map(participate => participate.contestId);
  const contests = await collections.contests
    .find({ _id: { $in: contestIds.map(id => new ObjectId(id)) } })
    .toArray();

  return res.json(contests);
};

export const getParticipatorContestsByPaidStatus = async (req, res) => {
  const { paymentStatus, email } = req.query;
  const query = {};
  if (email) {
    query.customer_email = email;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  // console.log(query);

  const payments = await collections.payments.find(query).toArray();

  const isPaid = payments.every(pay => pay.paymentStatus === 'paid');

  if (isPaid) {
    const contestIds = payments.map(pay => pay.contestId);
    const transactionIds = payments.map(pay => pay.transactionId);

    const contests = await collections.contests
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
};

export const getContestById = async (req, res) => {
  const { id } = req.params;
  // console.log(id);

  const contest = await collections.contests.findOne({
    _id: new ObjectId(id),
  });

  res.json(contest);
};

export const createContest = async (req, res) => {
  const contestInfo = req.body;
  contestInfo.createdAt = new Date();

  const result = await collections.contests.insertOne(contestInfo);

  res.json(result);
};

export const updateContest = async (req, res) => {
  const { id } = req.params;
  const updatedInfo = req.body;
  // console.log(updatedInfo);

  const updateDoc = {
    $set: updatedInfo,
  };

  const result = await collections.contests.updateOne(
    { _id: new ObjectId(id) },
    updateDoc
  );

  // update participate contestDeadline
  const contestDeadline = updatedInfo.contestDeadline;
  // console.log(contestDeadline);
  if (contestDeadline) {
    const participateResult = await collections.participates.updateMany(
      { contestId: id },
      {
        $set: {
          contestDeadline,
        },
      }
    );
  }

  res.json(result);
};

export const deleteContest = async (req, res) => {
  const { id } = req.params;

  const result = await collections.contests.deleteOne({
    _id: new ObjectId(id),
  });

  res.json(result);
};
