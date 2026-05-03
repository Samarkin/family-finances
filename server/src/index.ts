import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import Database from 'better-sqlite3';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const db = new Database(':memory:');

app.use(cors());
app.use(express.json());

app.get('/api/status', (_req, res) => {
  const row = db.prepare("SELECT 'ok' AS status").get() as { status: string };
  res.json({ status: row.status, db: 'connected' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
