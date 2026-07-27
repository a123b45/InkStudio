import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Book from '../models/Book';
import Volume from '../models/Volume';
import Chapter from '../models/Chapter';

const router = Router();

// All book routes require authentication
router.use(protect);

/**
 * GET /api/books
 * Get all books belonging to the authenticated user.
 * Optional query params: category, tag
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const filter: Record<string, any> = { author: req.user!._id };

      if (req.query.category) {
        filter.category = req.query.category;
      }
      if (req.query.tag) {
        filter.tags = req.query.tag;
      }

      const books = await Book.find(filter)
        .select('title description category tags cover updatedAt createdAt')
        .sort({ updatedAt: -1 });

      res.json(books);
    } catch (error) {
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

/**
 * POST /api/books
 * Create a new book for the authenticated user.
 */
router.post(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, description, category, tags, cover, content } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({ message: '书名不能为空' });
        return;
      }

      const book = await Book.create({
        title: title.trim(),
        description: description || '',
        category: category || '',
        tags: tags || [],
        cover: cover || '',
        content: content || [
          {
            type: 'paragraph',
            children: [{ text: '' }],
          },
        ],
        author: req.user!._id,
      });

      res.status(201).json(book);
    } catch (error) {
      res.status(500).json({ message: '创建书籍失败' });
    }
  }
);

/**
 * POST /api/books/sync
 * Sync books — returns all user's books with server timestamp.
 * Client sends optional lastSync timestamp.
 */
router.post(
  '/sync',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { lastSync } = req.body;

      const filter: Record<string, any> = { author: req.user!._id };

      // If lastSync provided, only return books updated after that time
      if (lastSync) {
        filter.updatedAt = { $gt: new Date(lastSync) };
      }

      const books = await Book.find(filter)
        .sort({ updatedAt: -1 });

      res.json({
        books,
        serverTime: new Date().toISOString(),
        count: books.length,
      });
    } catch (error) {
      res.status(500).json({ message: '同步失败' });
    }
  }
);

/**
 * POST /api/books/import-structure
 * Import a book with volumes and chapters (e.g. from TXT parse).
 */
router.post(
  '/import-structure',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, description, category, tags, cover, volumes } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({ message: '书名不能为空' });
        return;
      }

      if (!volumes || !Array.isArray(volumes) || volumes.length === 0) {
        res.status(400).json({ message: '至少需要一卷内容' });
        return;
      }

      const book = await Book.create({
        title: title.trim(),
        description: description || '',
        category: category || '导入',
        tags: tags || ['导入'],
        cover: cover || '',
        content: [{ type: 'paragraph', children: [{ text: '' }] }],
        author: req.user!._id,
      });

      let chapterTotal = 0;

      for (let vi = 0; vi < volumes.length; vi++) {
        const volData = volumes[vi];
        const volTitle = (volData.title || `第${vi + 1}卷`).trim();

        const volume = await Volume.create({
          title: volTitle,
          book: book._id,
          author: req.user!._id,
          order: vi,
        });

        const chapters = Array.isArray(volData.chapters) ? volData.chapters : [];
        for (let ci = 0; ci < chapters.length; ci++) {
          const chapData = chapters[ci];
          const chapTitle = (chapData.title || `第${ci + 1}章`).trim();
          const content =
            chapData.content && Array.isArray(chapData.content) && chapData.content.length > 0
              ? chapData.content
              : [{ type: 'paragraph', children: [{ text: '' }] }];

          await Chapter.create({
            title: chapTitle,
            content,
            volume: volume._id,
            author: req.user!._id,
            order: ci,
          });
          chapterTotal++;
        }
      }

      res.status(201).json({
        book,
        volumeCount: volumes.length,
        chapterCount: chapterTotal,
      });
    } catch (error) {
      res.status(500).json({ message: '导入书籍失败' });
    }
  }
);

/**
 * POST /api/books/import
 * Import a book from external data.
 */
router.post(
  '/import',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, description, category, tags, cover, content } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({ message: '书名不能为空' });
        return;
      }

      const book = await Book.create({
        title: title.trim(),
        description: description || '',
        category: category || '导入',
        tags: tags || ['导入'],
        cover: cover || '',
        content: content || [
          {
            type: 'paragraph',
            children: [{ text: description || '' }],
          },
        ],
        author: req.user!._id,
      });

      res.status(201).json(book);
    } catch (error) {
      res.status(500).json({ message: '导入书籍失败' });
    }
  }
);

/**
 * GET /api/books/:id
 * Get a single book by ID (must belong to the user).
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const book = await Book.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!book) {
        res.status(404).json({ message: '书籍未找到' });
        return;
      }

      res.json(book);
    } catch (error) {
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

/**
 * PUT /api/books/:id
 * Update a book's metadata.
 */
router.put(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, description, category, tags, cover, content } = req.body;

      const book = await Book.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!book) {
        res.status(404).json({ message: '书籍未找到' });
        return;
      }

      if (title !== undefined) book.title = title;
      if (description !== undefined) book.description = description;
      if (category !== undefined) book.category = category;
      if (tags !== undefined) book.tags = tags;
      if (cover !== undefined) book.cover = cover;
      if (content !== undefined) book.content = content;

      const updated = await book.save();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: '更新书籍失败' });
    }
  }
);

/**
 * DELETE /api/books/:id
 * Delete a book by ID (must belong to the user).
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const book = await Book.findOneAndDelete({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!book) {
        res.status(404).json({ message: '书籍未找到' });
        return;
      }

      res.json({ message: '书籍已删除' });
    } catch (error) {
      res.status(500).json({ message: '删除书籍失败' });
    }
  }
);

export default router;
