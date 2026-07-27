import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect } from '../middleware/auth';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'covers');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `cover-${uniqueSuffix}${ext}`);
  },
});

// Filter for image files only
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP)'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// All upload routes require authentication
router.use(protect);

/**
 * POST /api/upload/cover
 * Upload a book cover image.
 * Returns the URL path to the uploaded file.
 */
router.post(
  '/cover',
  (req: Request, res: Response): void => {
    upload.single('cover')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ message: '文件大小不能超过 5MB' });
          return;
        }
        res.status(400).json({ message: `上传错误: ${err.message}` });
        return;
      }
      if (err) {
        res.status(400).json({ message: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: '请选择要上传的图片' });
        return;
      }

      const url = `/uploads/covers/${req.file.filename}`;
      res.status(201).json({ url, filename: req.file.filename });
    });
  }
);

export default router;
