import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Volume from '../models/Volume';
import Chapter from '../models/Chapter';

const router = Router();
router.use(protect);

/**
 * GET /api/volumes?book=:bookId
 * List all volumes for a book, with populated chapters.
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { book } = req.query;
      if (!book) {
        res.status(400).json({ message: '缺少 book 参数' });
        return;
      }

      const volumes = await Volume.find({
        book,
        author: req.user!._id,
      }).sort({ order: 1, createdAt: 1 });

      // Populate chapters for each volume
      const result = await Promise.all(
        volumes.map(async (vol) => {
          const chapters = await Chapter.find({ volume: vol._id })
            .select('title order updatedAt')
            .sort({ order: 1, createdAt: 1 });
          return { ...vol.toObject(), chapters };
        })
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: '获取卷列表失败' });
    }
  }
);

/**
 * POST /api/volumes
 * Create a new volume for a book.
 */
router.post(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, book, order } = req.body;
      if (!title || !title.trim()) {
        res.status(400).json({ message: '卷名不能为空' });
        return;
      }
      if (!book) {
        res.status(400).json({ message: '缺少 book 参数' });
        return;
      }

      // Auto-set order to be after the last volume
      let volOrder = order;
      if (volOrder === undefined) {
        const count = await Volume.countDocuments({ book, author: req.user!._id });
        volOrder = count;
      }

      const volume = await Volume.create({
        title: title.trim(),
        book,
        author: req.user!._id,
        order: volOrder,
      });

      res.status(201).json({ ...volume.toObject(), chapters: [] });
    } catch (error) {
      res.status(500).json({ message: '创建卷失败' });
    }
  }
);

/**
 * PUT /api/volumes/:id
 * Update a volume.
 */
router.put(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, order } = req.body;
      const volume = await Volume.findOne({ _id: req.params.id, author: req.user!._id });
      if (!volume) {
        res.status(404).json({ message: '卷未找到' });
        return;
      }
      if (title !== undefined) volume.title = title;
      if (order !== undefined) volume.order = order;
      await volume.save();
      res.json(volume);
    } catch (error) {
      res.status(500).json({ message: '更新卷失败' });
    }
  }
);

/**
 * PUT /api/volumes/reorder
 * Batch reorder volumes.
 * Body: { book: string, volumeIds: string[] }
 */
router.put(
  '/reorder',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { book, volumeIds } = req.body;
      if (!book || !volumeIds || !Array.isArray(volumeIds)) {
        res.status(400).json({ message: '参数无效' });
        return;
      }

      await Promise.all(
        volumeIds.map((id, idx) =>
          Volume.findOneAndUpdate(
            { _id: id, book, author: req.user!._id },
            { order: idx }
          )
        )
      );

      res.json({ message: '排序已更新' });
    } catch (error) {
      res.status(500).json({ message: '排序失败' });
    }
  }
);

/**
 * DELETE /api/volumes/batch
 * Batch delete volumes and their chapters. MUST be before /:id.
 * Body: { ids: string[] }
 */
router.delete(
  '/batch',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ message: '请选择要删除的卷' });
        return;
      }
      await Volume.deleteMany({ _id: { $in: ids }, author: req.user!._id });
      await Chapter.deleteMany({ volume: { $in: ids } });
      res.json({ message: `已删除 ${ids.length} 个卷` });
    } catch (error) {
      res.status(500).json({ message: '批量删除失败' });
    }
  }
);

/**
 * DELETE /api/volumes/:id
 * Delete a volume and all its chapters.
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const volume = await Volume.findOneAndDelete({
        _id: req.params.id,
        author: req.user!._id,
      });
      if (!volume) {
        res.status(404).json({ message: '卷未找到' });
        return;
      }
      // Delete all chapters in this volume
      await Chapter.deleteMany({ volume: req.params.id });
      res.json({ message: '卷已删除' });
    } catch (error) {
      res.status(500).json({ message: '删除卷失败' });
    }
  }
);

export default router;
