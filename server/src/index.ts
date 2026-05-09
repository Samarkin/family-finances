import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { getDb } from './db/connection.js';
import uploadRouter from './routes/upload.js';
import previewRouter from './routes/preview.js';
import accountsRouter from './routes/accounts.js';
import personsRouter from './routes/persons.js';
import transactionsRouter from './routes/transactions.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Enable JSON request parsing
app.use(express.json());
app.use(cors());

// Routes
app.use('/api', uploadRouter);
app.use('/api', previewRouter);
app.use('/api', accountsRouter);
app.use('/api', personsRouter);
app.use('/api', transactionsRouter);

// GET /api/status endpoint
app.get('/api/status', (_req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT 'ok' AS status").get() as { status: string };
    res.json({
      status: row.status,
      db: db.memory ? 'memory' : 'file',
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

export default app;
