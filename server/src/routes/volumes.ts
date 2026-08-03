import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Volume from '../models/Volume';
import Chapter from '../models/Chapter';

const router = Router();
router.use(protect);

const notDeleted = { deletedAt: null };

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { book } = req.query;
    if (!book) {
      res.status(400).json({ message: '缺少 book 参数' });
      return;
    }

    const volumes = await Volume.find({ book, author: req.user!._id, ...notDeleted }).sort({ order: 1, createdAt: 1 });

    const result = await Promise.all(
      volumes.map(async (vol) => {
        const chapters = await Chapter.find({ volume: vol._id, ...notDeleted })
          .select('title order updatedAt summary')
          .sort({ order: 1, createdAt: 1 });
        return { ...vol.toObject(), chapters };
      })
    );

    res.json(result);
  } catch {
    res.status(500).json({ message: '获取卷列表失败' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, book, order } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ message: '卷名不能为空' });
      return;
    }
    if (!book) {
      res.status(400).json({ message: '缺少 book 参数' });
      return;
    }

    let volOrder = order;
    if (volOrder === undefined) {
      volOrder = await Volume.countDocuments({ book, author: req.user!._id, ...notDeleted });
    }

    const volume = await Volume.create({
      title: title.trim(),
      book,
      author: req.user!._id,
      order: volOrder,
    });

    res.status(201).json({ ...volume.toObject(), chapters: [] });
  } catch {
    res.status(500).json({ message: '创建卷失败' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, order } = req.body;
    const volume = await Volume.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!volume) {
      res.status(404).json({ message: '卷未找到' });
      return;
    }
    if (title !== undefined) volume.title = title;
    if (order !== undefined) volume.order = order;
    res.json(await volume.save());
  } catch {
    res.status(500).json({ message: '更新卷失败' });
  }
});

router.put('/reorder', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { book, volumeIds } = req.body;
    if (!book || !Array.isArray(volumeIds)) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    await Promise.all(
      volumeIds.map((id, idx) =>
        Volume.findOneAndUpdate({ _id: id, book, author: req.user!._id, ...notDeleted }, { order: idx })
      )
    );

    res.json({ message: '排序已更新' });
  } catch {
    res.status(500).json({ message: '排序失败' });
  }
});

router.delete('/batch', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids?.length) {
      res.status(400).json({ message: '请选择要删除的卷' });
      return;
    }
    const now = new Date();
    await Volume.updateMany({ _id: { $in: ids }, author: req.user!._id }, { deletedAt: now });
    await Chapter.updateMany({ volume: { $in: ids } }, { deletedAt: now });
    res.json({ message: `已删除 ${ids.length} 个卷` });
  } catch {
    res.status(500).json({ message: '批量删除失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const volume = await Volume.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!volume) {
      res.status(404).json({ message: '卷未找到' });
      return;
    }
    const now = new Date();
    volume.deletedAt = now;
    await volume.save();
    await Chapter.updateMany({ volume: req.params.id }, { deletedAt: now });
    res.json({ message: '卷已删除' });
  } catch {
    res.status(500).json({ message: '删除卷失败' });
  }
});

export default router;
