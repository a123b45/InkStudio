import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import bookRoutes from './routes/books';
import groupRoutes from './routes/groups';
import volumeRoutes from './routes/volumes';
import chapterRoutes from './routes/chapters';
import uploadRoutes from './routes/upload';
import trashRoutes from './routes/trash';
import publicRoutes from './routes/public';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const defaultOrigins = [
  'http://localhost:5173',
  'https://inkstudio.work',
  'https://www.inkstudio.work',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
];

const deployHost = process.env.DEPLOY_HOST?.trim();
if (deployHost) {
  for (const port of ['', ':8080', ':5000', ':5173']) {
    defaultOrigins.push(`http://${deployHost}${port}`);
  }
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : defaultOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin) || origin.startsWith('capacitor://')) {
        callback(null, origin);
        return;
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/volumes', volumeRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/public', publicRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();
