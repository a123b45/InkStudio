import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Book from '../models/Book';
import Volume from '../models/Volume';
import Chapter from '../models/Chapter';
import ChapterVersion from '../models/ChapterVersion';

const router = Router();
router.use(protect);

/**
 * GET /api/trash
 * List soft-deleted books.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const books = await Book.find({
      author: req.user!._id,
      deletedAt: { $ne: null },
    })
      .select('title category cover deletedAt updatedAt')
      .sort({ deletedAt: -1 });

    res.json(books);
  } catch {
    res.status(500).json({ message: '获取回收站失败' });
  }
});

/**
 * POST /api/trash/restore/book/:id
 */
router.post('/restore/book/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findOne({
      _id: req.params.id,
      author: req.user!._id,
      deletedAt: { $ne: null },
    });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }

    book.deletedAt = null;
    await book.save();

    await Volume.updateMany(
      { book: book._id, author: req.user!._id },
      { deletedAt: null }
    );
    const volIds = await Volume.find({ book: book._id }).distinct('_id');
    await Chapter.updateMany(
      { volume: { $in: volIds }, author: req.user!._id },
      { deletedAt: null }
    );

    res.json({ message: '书籍已恢复' });
  } catch {
    res.status(500).json({ message: '恢复失败' });
  }
});

/**
 * DELETE /api/trash/book/:id
 * Permanently delete a book and all related data.
 */
router.delete('/book/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findOne({
      _id: req.params.id,
      author: req.user!._id,
      deletedAt: { $ne: null },
    });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }

    const volIds = await Volume.find({ book: book._id }).distinct('_id');
    const chapIds = await Chapter.find({ volume: { $in: volIds } }).distinct('_id');

    await ChapterVersion.deleteMany({ chapter: { $in: chapIds } });
    await Chapter.deleteMany({ volume: { $in: volIds } });
    await Volume.deleteMany({ book: book._id });
    await book.deleteOne();

    res.json({ message: '书籍已永久删除' });
  } catch {
    res.status(500).json({ message: '永久删除失败' });
  }
});

/**
 * DELETE /api/trash/empty
 * Empty entire trash for user.
 */
router.delete('/empty', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deletedBooks = await Book.find({
      author: req.user!._id,
      deletedAt: { $ne: null },
    });
    for (const book of deletedBooks) {
      const volIds = await Volume.find({ book: book._id }).distinct('_id');
      const chapIds = await Chapter.find({ volume: { $in: volIds } }).distinct('_id');
      await ChapterVersion.deleteMany({ chapter: { $in: chapIds } });
      await Chapter.deleteMany({ volume: { $in: volIds } });
      await Volume.deleteMany({ book: book._id });
      await book.deleteOne();
    }
    res.json({ message: '回收站已清空' });
  } catch {
    res.status(500).json({ message: '清空回收站失败' });
  }
});

export default router;
