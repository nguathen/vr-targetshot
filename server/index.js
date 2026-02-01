import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { iapRouter } from './routes/iap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Stripe webhook needs raw body
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api', iapRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from dist/ in production
const distRoot = join(__dirname, '..', 'client', 'dist');
app.use(express.static(distRoot));
app.use(express.static(join(distRoot, 'src')));
app.get('*', (_req, res) => {
  res.sendFile(join(distRoot, 'src', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
