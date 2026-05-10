import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from './db/connection.js';
import uploadRouter from './routes/upload.js';
import previewRouter from './routes/preview.js';
import accountsRouter from './routes/accounts.js';
import personsRouter from './routes/persons.js';
import transactionsRouter from './routes/transactions.js';
import filesRouter from './routes/files.js';
import summaryRouter from './routes/summary.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable JSON request parsing
app.use(express.json());
app.use(cors());

// Routes
app.use('/api', uploadRouter);
app.use('/api', previewRouter);
app.use('/api', accountsRouter);
app.use('/api', personsRouter);
app.use('/api', transactionsRouter);
app.use('/api', filesRouter);
app.use('/api', summaryRouter);

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

// Serve static client files
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Handle client-side routing
  app.get('{/*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

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
