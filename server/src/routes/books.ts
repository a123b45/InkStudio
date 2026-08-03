import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Book from '../models/Book';
import Volume from '../models/Volume';
import Chapter from '../models/Chapter';
import ChapterVersion from '../models/ChapterVersion';
import { extractSnippet, slateToPlainText } from '../utils/contentUtils';

const router = Router();
router.use(protect);

const notDeleted = { deletedAt: null };

/**
 * GET /api/books
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, any> = { author: req.user!._id, ...notDeleted };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.tag) filter.tags = req.query.tag;

    const books = await Book.find(filter)
      .select('title description category tags cover isPublic updatedAt createdAt')
      .sort({ updatedAt: -1 });

    res.json(books);
  } catch {
    res.status(500).json({ message: '服务器错误' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, tags, cover } = req.body;
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
      content: [{ type: 'paragraph', children: [{ text: '' }] }],
      author: req.user!._id,
    });

    res.status(201).json(book);
  } catch {
    res.status(500).json({ message: '创建书籍失败' });
  }
});

router.post('/sync', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lastSync } = req.body;
    const filter: Record<string, any> = { author: req.user!._id, ...notDeleted };
    if (lastSync) filter.updatedAt = { $gt: new Date(lastSync) };

    const books = await Book.find(filter).sort({ updatedAt: -1 });
    res.json({ books, serverTime: new Date().toISOString(), count: books.length });
  } catch {
    res.status(500).json({ message: '同步失败' });
  }
});

router.post('/import-structure', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, tags, cover, volumes } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ message: '书名不能为空' });
      return;
    }
    if (!volumes?.length) {
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
      const volume = await Volume.create({
        title: (volData.title || `第${vi + 1}卷`).trim(),
        book: book._id,
        author: req.user!._id,
        order: vi,
      });

      const chapters = Array.isArray(volData.chapters) ? volData.chapters : [];
      for (let ci = 0; ci < chapters.length; ci++) {
        const chapData = chapters[ci];
        await Chapter.create({
          title: (chapData.title || `第${ci + 1}章`).trim(),
          content: chapData.content?.length ? chapData.content : [{ type: 'paragraph', children: [{ text: '' }] }],
          volume: volume._id,
          author: req.user!._id,
          order: ci,
        });
        chapterTotal++;
      }
    }

    res.status(201).json({ book, volumeCount: volumes.length, chapterCount: chapterTotal });
  } catch {
    res.status(500).json({ message: '导入书籍失败' });
  }
});

router.post('/import', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, tags, cover, content } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ message: '书名不能为空' });
      return;
    }

    const book = await Book.create({
      title: title.trim(),
      description: description || '',
      category: category || '导入',
      tags: tags || ['导入'],
      cover: cover || '',
      content: content || [{ type: 'paragraph', children: [{ text: description || '' }] }],
      author: req.user!._id,
    });

    res.status(201).json(book);
  } catch {
    res.status(500).json({ message: '导入书籍失败' });
  }
});

/**
 * GET /api/books/:id/search?q=keyword
 * Full-book search across chapter titles and content.
 */
router.get('/:id/search', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ message: '请输入搜索关键词' });
      return;
    }

    const book = await Book.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }

    const volumes = await Volume.find({ book: book._id, ...notDeleted }).sort({ order: 1 });
    const results: any[] = [];
    const lowerQ = q.toLowerCase();

    for (const vol of volumes) {
      const chapters = await Chapter.find({ volume: vol._id, ...notDeleted }).sort({ order: 1 });
      for (const chap of chapters) {
        const titleMatch = chap.title.toLowerCase().includes(lowerQ);
        const plain = slateToPlainText(chap.content);
        const contentMatch = plain.toLowerCase().includes(lowerQ);
        if (titleMatch || contentMatch) {
          results.push({
            chapterId: chap._id,
            chapterTitle: chap.title,
            volumeId: vol._id,
            volumeTitle: vol.title,
            matchInTitle: titleMatch,
            snippet: contentMatch ? extractSnippet(plain, q) : '',
          });
        }
      }
    }

    res.json({ query: q, count: results.length, results });
  } catch {
    res.status(500).json({ message: '搜索失败' });
  }
});

/**
 * GET /api/books/:id/backup
 * Export full book structure as JSON backup.
 */
router.get('/:id/backup', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }

    const volumes = await Volume.find({ book: book._id, ...notDeleted }).sort({ order: 1 });
    const volumeData = await Promise.all(
      volumes.map(async (vol) => {
        const chapters = await Chapter.find({ volume: vol._id, ...notDeleted }).sort({ order: 1 });
        return {
          title: vol.title,
          order: vol.order,
          chapters: chapters.map((c) => ({
            title: c.title,
            order: c.order,
            summary: c.summary,
            content: c.content,
          })),
        };
      })
    );

    res.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      book: {
        title: book.title,
        description: book.description,
        category: book.category,
        tags: book.tags,
        cover: book.cover,
      },
      volumes: volumeData,
    });
  } catch {
    res.status(500).json({ message: '备份导出失败' });
  }
});

/**
 * GET /api/books/:id/stats
 * Book-wide word count statistics.
 */
router.get('/:id/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }

    const volumes = await Volume.find({ book: book._id, ...notDeleted }).sort({ order: 1 });
    let totalWords = 0;
    let totalChapters = 0;
    const volumeStats = [];

    for (const vol of volumes) {
      const chapters = await Chapter.find({ volume: vol._id, ...notDeleted }).sort({ order: 1 });
      let volWords = 0;
      for (const chap of chapters) {
        const text = slateToPlainText(chap.content);
        const chinese = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
        const english = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').split(/\s+/).filter(Boolean).length;
        volWords += chinese + english;
        totalChapters++;
      }
      totalWords += volWords;
      volumeStats.push({ volumeId: vol._id, title: vol.title, words: volWords, chapters: chapters.length });
    }

    res.json({ bookId: book._id, totalWords, totalChapters, volumes: volumeStats });
  } catch {
    res.status(500).json({ message: '统计失败' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }
    res.json(book);
  } catch {
    res.status(500).json({ message: '服务器错误' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, tags, cover, isPublic } = req.body;
    const book = await Book.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }

    if (title !== undefined) book.title = title;
    if (description !== undefined) book.description = description;
    if (category !== undefined) book.category = category;
    if (tags !== undefined) book.tags = tags;
    if (cover !== undefined) book.cover = cover;
    if (isPublic !== undefined) book.isPublic = isPublic;

    res.json(await book.save());
  } catch {
    res.status(500).json({ message: '更新书籍失败' });
  }
});

/**
 * DELETE /api/books/:id — soft delete with cascade
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!book) {
      res.status(404).json({ message: '书籍未找到' });
      return;
    }

    const now = new Date();
    book.deletedAt = now;
    await book.save();

    const volIds = await Volume.find({ book: book._id }).distinct('_id');
    await Volume.updateMany({ book: book._id }, { deletedAt: now });
    await Chapter.updateMany({ volume: { $in: volIds } }, { deletedAt: now });

    res.json({ message: '书籍已移入回收站' });
  } catch {
    res.status(500).json({ message: '删除书籍失败' });
  }
});

export default router;
