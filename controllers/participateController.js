import { ObjectId } from 'mongodb';
import { collections } from '../config/db.js';

export const getSpecificParticipate = async (req, res) => {
  const { contestId, email } = req.params;
  const query = {};
  if (email) {
    query.participatorEmail = email;
  }
  if (contestId) {
    query.contestId = contestId;
  }

  // console.log(query);

  const participatorInfo = await collections.participates.findOne(query);

  res.json(participatorInfo);
};

export const getSubmissionsOrWinner = async (req, res) => {
  const { contestId } = req.params;

  const { winner } = req.query;

  // console.log(winner);

  if (winner) {
    const winnerParticipator = await collections.participates.findOne({
      contestId,
      winner: !!winner,
    });

    // console.log(winnerParticipator);

    return res.json(winnerParticipator);
  }

  const submissions = await collections.participates
    .find({ contestId, submittedTask: { $exists: true } })
    .toArray();

  res.json(submissions);
};

export const getParticipatorContestStats = async (req, res) => {
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

  const stats = await collections.participates.aggregate(pipeline).toArray();

  // console.log(stats);

  if (stats.length === 0) {
    return res.json({
      totalContestWon: 0,
      totalContestParticipate: 0,
    });
  }

  res.json(stats);
};

export const addWinnerParticipate = async (req, res) => {
  const { id } = req.params;
  const { contestId } = req.query;
  const updateWinner = req.body;

  const result = await collections.participates.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: updateWinner,
    }
  );

  const updateLoserResult = await collections.participates.updateMany(
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
};

export const addSubmittedTaskInfo = async (req, res) => {
  const submissionInfo = req.body;
  const { contestId, email } = req.params;

  const query = {};
  if (email) {
    query.participatorEmail = email;
  }
  if (contestId) {
    query.contestId = contestId;
  }

  const contestResult = await collections.contests.updateOne(
    { _id: new ObjectId(contestId) },
    { $inc: { submissionCount: 1 } }
  );

  const updateParticipate = {
    $set: {
      submittedTask: submissionInfo.submittedTask,
    },
  };

  const result = await collections.participates.updateOne(
    query,
    updateParticipate
  );

  res.json(result);
};
