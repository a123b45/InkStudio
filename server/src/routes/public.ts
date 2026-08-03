import { Router, Response } from 'express';
import Book from '../models/Book';
import Volume from '../models/Volume';
import Chapter from '../models/Chapter';
import { slateToPlainText } from '../utils/contentUtils';

const router = Router();

/**
 * GET /api/public/books/:id
 * Public read-only book (requires isPublic).
 */
router.get('/books/:id', async (req, res: Response): Promise<void> => {
  try {
    const book = await Book.findOne({
      _id: req.params.id,
      isPublic: true,
      deletedAt: null,
    }).select('title description category cover author createdAt updatedAt');

    if (!book) {
      res.status(404).json({ message: '书籍未找到或未公开' });
      return;
    }

    const volumes = await Volume.find({ book: book._id, deletedAt: null }).sort({ order: 1 });
    const result = await Promise.all(
      volumes.map(async (vol) => {
        const chapters = await Chapter.find({ volume: vol._id, deletedAt: null })
          .select('title order summary updatedAt')
          .sort({ order: 1 });
        return { ...vol.toObject(), chapters };
      })
    );

    res.json({ book, volumes: result });
  } catch {
    res.status(500).json({ message: '服务器错误' });
  }
});

/**
 * GET /api/public/chapters/:id
 * Public chapter content.
 */
router.get('/chapters/:id', async (req, res: Response): Promise<void> => {
  try {
    const chapter = await Chapter.findOne({
      _id: req.params.id,
      deletedAt: null,
    });
    if (!chapter) {
      res.status(404).json({ message: '章节未找到' });
      return;
    }

    const volume = await Volume.findOne({ _id: chapter.volume, deletedAt: null });
    if (!volume) {
      res.status(404).json({ message: '章节未找到' });
      return;
    }

    const book = await Book.findOne({
      _id: volume.book,
      isPublic: true,
      deletedAt: null,
    });
    if (!book) {
      res.status(404).json({ message: '章节未公开' });
      return;
    }

    res.json({
      chapter: {
        _id: chapter._id,
        title: chapter.title,
        content: chapter.content,
        order: chapter.order,
        updatedAt: chapter.updatedAt,
      },
      volume: { _id: volume._id, title: volume.title },
      book: { _id: book._id, title: book.title, description: book.description },
    });
  } catch {
    res.status(500).json({ message: '服务器错误' });
  }
});

export { slateToPlainText };
export default router;
