
import express, { Request, Response } from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL Connection with safety check
const { Pool } = pg;
const hasDb = !!process.env.DATABASE_URL;

const pool = hasDb ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
}) : null;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database Initialization
const initDb = async () => {
  if (!pool) {
    console.warn('DATABASE_URL not found. Running with transient in-memory state only.');
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
};
initDb();

// API: Fetch all matches
app.get('/api/matches', async (_req: Request, res: Response) => {
  if (!pool) return res.json([]);
  try {
    const result = await pool.query('SELECT data FROM matches ORDER BY updated_at DESC');
    res.json(result.rows.map((row: any) => row.data));
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// API: Sync match data
app.post('/api/sync', async (req: Request, res: Response) => {
  const match = req.body;
  if (!match || !match.id) {
    return res.status(400).json({ error: 'Invalid match data' });
  }

  if (!pool) return res.json({ success: true, localOnly: true });

  try {
    await pool.query(`
      INSERT INTO matches (id, data, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET data = $2, updated_at = CURRENT_TIMESTAMP;
    `, [match.id, match]);
    res.json({ success: true });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Failed to sync match' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
