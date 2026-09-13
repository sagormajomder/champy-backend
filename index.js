import cors from 'cors';
import express from 'express';
import { connectDB } from './config/db.js';
import contestRoutes from './routes/contestRoutes.js';
import participateRoutes from './routes/participateRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Server Root Route
app.get('/', (req, res) => {
  res.send('<h1>Hello World </h1>');
});

// Routes
app.use(userRoutes);
app.use(contestRoutes);
app.use(paymentRoutes);
app.use(participateRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ error: 'Internal Server Error', message: err.message });
});

if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
      });
    })
    .catch(console.dir);
}

export default app;
