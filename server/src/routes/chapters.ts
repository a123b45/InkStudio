import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Chapter from '../models/Chapter';

const router = Router();
router.use(protect);

/**
 * GET /api/chapters/:id
 * Get a single chapter with full content.
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const chapter = await Chapter.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });
      if (!chapter) {
        res.status(404).json({ message: '章节未找到' });
        return;
      }
      res.json(chapter);
    } catch (error) {
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

/**
 * POST /api/chapters
 * Create a new chapter within a volume.
 */
router.post(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, volume, order } = req.body;
      if (!title || !title.trim()) {
        res.status(400).json({ message: '章名不能为空' });
        return;
      }
      if (!volume) {
        res.status(400).json({ message: '缺少 volume 参数' });
        return;
      }

      let chapOrder = order;
      if (chapOrder === undefined) {
        const count = await Chapter.countDocuments({ volume, author: req.user!._id });
        chapOrder = count;
      }

      const chapter = await Chapter.create({
        title: title.trim(),
        volume,
        author: req.user!._id,
        order: chapOrder,
      });

      res.status(201).json(chapter);
    } catch (error) {
      res.status(500).json({ message: '创建章节失败' });
    }
  }
);

/**
 * PUT /api/chapters/reorder
 * Batch reorder chapters within a volume. MUST be before /:id.
 * Body: { volume: string, chapterIds: string[] }
 */
router.put(
  '/reorder',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { volume, chapterIds } = req.body;
      if (!volume || !chapterIds || !Array.isArray(chapterIds)) {
        res.status(400).json({ message: '参数无效' });
        return;
      }

      await Promise.all(
        chapterIds.map((id, idx) =>
          Chapter.findOneAndUpdate(
            { _id: id, volume, author: req.user!._id },
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
 * DELETE /api/chapters/batch
 * Batch delete chapters. MUST be before /:id.
 * Body: { ids: string[] }
 */
router.delete(
  '/batch',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ message: '请选择要删除的章节' });
        return;
      }
      await Chapter.deleteMany({ _id: { $in: ids }, author: req.user!._id });
      res.json({ message: `已删除 ${ids.length} 个章节` });
    } catch (error) {
      res.status(500).json({ message: '批量删除失败' });
    }
  }
);

/**
 * PUT /api/chapters/:id
 * Update a chapter's title, content, or order.
 */
router.put(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, content, order } = req.body;
      const chapter = await Chapter.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });
      if (!chapter) {
        res.status(404).json({ message: '章节未找到' });
        return;
      }
      if (title !== undefined) chapter.title = title;
      if (content !== undefined) chapter.content = content;
      if (order !== undefined) chapter.order = order;
      await chapter.save();
      res.json(chapter);
    } catch (error) {
      res.status(500).json({ message: '更新章节失败' });
    }
  }
);

/**
 * DELETE /api/chapters/:id
 * Delete a chapter.
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const chapter = await Chapter.findOneAndDelete({
        _id: req.params.id,
        author: req.user!._id,
      });
      if (!chapter) {
        res.status(404).json({ message: '章节未找到' });
        return;
      }
      res.json({ message: '章节已删除' });
    } catch (error) {
      res.status(500).json({ message: '删除章节失败' });
    }
  }
);

export default router;
