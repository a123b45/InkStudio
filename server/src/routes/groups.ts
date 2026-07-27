import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Group from '../models/Group';
import Book from '../models/Book';

const router = Router();

router.use(protect);

/**
 * GET /api/groups
 * List all groups belonging to the user, with populated book info.
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const groups = await Group.find({ author: req.user!._id })
        .populate('books', 'title description category tags cover updatedAt')
        .sort({ updatedAt: -1 });

      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: '获取分组列表失败' });
    }
  }
);

/**
 * GET /api/groups/:id
 * Get a single group with populated books.
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const group = await Group.findOne({
        _id: req.params.id,
        author: req.user!._id,
      }).populate('books', 'title description category tags cover updatedAt');

      if (!group) {
        res.status(404).json({ message: '分组未找到' });
        return;
      }

      res.json(group);
    } catch (error) {
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

/**
 * POST /api/groups
 * Create a new group. Auto-populates books based on the grouping method.
 */
router.post(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, method, config } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ message: '分组名称不能为空' });
        return;
      }

      const authorId = req.user!._id;
      let bookIds: any[] = [];

      // Auto-populate books based on grouping method
      switch (method) {
        case 'tags': {
          const tags: string[] = config?.tags || [];
          if (tags.length > 0) {
            const books = await Book.find({
              author: authorId,
              tags: { $in: tags },
            }).select('_id');
            bookIds = books.map((b) => b._id);
          }
          break;
        }
        case 'category': {
          const categories: string[] = config?.categories || [];
          if (categories.length > 0) {
            const books = await Book.find({
              author: authorId,
              category: { $in: categories },
            }).select('_id');
            bookIds = books.map((b) => b._id);
          }
          break;
        }
        case 'bookName': {
          const searchStr: string = config?.bookName || '';
          if (searchStr.trim()) {
            // Fuzzy match: case-insensitive partial match on title
            const books = await Book.find({
              author: authorId,
              title: { $regex: searchStr.trim(), $options: 'i' },
            }).select('_id');
            bookIds = books.map((b) => b._id);
          }
          break;
        }
        case 'custom':
        default:
          // No auto-populate for custom groups
          bookIds = [];
          break;
      }

      const group = await Group.create({
        name: name.trim(),
        method: method || 'custom',
        config: config || {},
        books: bookIds,
        author: authorId,
      });

      // Return populated group
      const populated = await Group.findById(group._id).populate(
        'books',
        'title description category tags cover updatedAt'
      );

      res.status(201).json(populated);
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ message: '创建分组失败' });
    }
  }
);

/**
 * PUT /api/groups/:id
 * Update group metadata and/or manually manage books.
 */
router.put(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, config, books } = req.body;

      const group = await Group.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!group) {
        res.status(404).json({ message: '分组未找到' });
        return;
      }

      if (name !== undefined) group.name = name;
      if (config !== undefined) group.config = config;
      if (books !== undefined) group.books = books;

      const updated = await group.save();

      const populated = await Group.findById(updated._id).populate(
        'books',
        'title description category tags cover updatedAt'
      );

      res.json(populated);
    } catch (error) {
      res.status(500).json({ message: '更新分组失败' });
    }
  }
);

/**
 * DELETE /api/groups/:id
 * Delete a group (books are not deleted, just the group).
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const group = await Group.findOneAndDelete({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!group) {
        res.status(404).json({ message: '分组未找到' });
        return;
      }

      res.json({ message: '分组已删除' });
    } catch (error) {
      res.status(500).json({ message: '删除分组失败' });
    }
  }
);

/**
 * PUT /api/groups/:id/books/:bookId
 * Toggle a book in/out of a group. If book is in group, remove it; if not, add it.
 */
router.put(
  '/:id/books/:bookId',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const group = await Group.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!group) {
        res.status(404).json({ message: '分组未找到' });
        return;
      }

      const bookId = req.params.bookId as any;
      const idx = group.books.findIndex(
        (b) => b.toString() === bookId.toString()
      );

      if (idx === -1) {
        // Book not in group — add it
        group.books.push(bookId);
      } else {
        // Book in group — remove it
        group.books.splice(idx, 1);
      }

      await group.save();

      const populated = await Group.findById(group._id).populate(
        'books',
        'title description category tags cover updatedAt'
      );

      res.json(populated);
    } catch (error) {
      res.status(500).json({ message: '操作失败' });
    }
  }
);

export default router;
