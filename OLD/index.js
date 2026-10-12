import cors from 'cors';
import express from 'express';
import { closeDB, connectDB } from './config/db.js';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware.js';
import contestRoutes from './routes/contest.routes.js';
import participateRoutes from './routes/participate.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'https://champy-sm.web.app'],
    credentials: true,
  }),
);
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

app.use(notFoundHandler);
app.use(errorHandler);

// Crash / Unhandled Error Listeners
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (!process.env.VERCEL) process.exit(1);
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception thrown:', err);
  if (!process.env.VERCEL) process.exit(1);
});

// Vercel serverless export
export default app;

// Local Development only: Bind port and handle terminal graceful shutdown (Ctrl + C)
if (!process.env.VERCEL) {
  await connectDB();
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

  const handleLocalShutdown = async signal => {
    console.log(`Received ${signal}. Shutting down local server cleanly...`);
    await closeDB();
    process.exit(0);
  };

  process.on('SIGINT', () => handleLocalShutdown('SIGINT'));
  process.on('SIGTERM', () => handleLocalShutdown('SIGTERM'));
}
