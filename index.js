import cors from 'cors';
import express from 'express';
import { connectDB } from './config/db.js';
import contestRoutes from './routes/contestRoutes.js';
import participateRoutes from './routes/participateRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import userRoutes from './routes/userRoutes.js';

import dns from 'node:dns';
dns.setServers(['1.1.1.1']);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Server Root Route
app.get('/', (req, res) => {
  res.send('<h1>Hello World </h1>');
});

// Routes
app.use(userRoutes);
app.use(contestRoutes);
app.use(paymentRoutes);
app.use(participateRoutes);

async function run() {
  await connectDB();

  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

run().catch(console.dir);
