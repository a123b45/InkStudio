import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Chapter from '../models/Chapter';
import ChapterVersion from '../models/ChapterVersion';
import { countWordsInContent } from '../utils/contentUtils';

const router = Router();
router.use(protect);

const notDeleted = { deletedAt: null };
const MAX_VERSIONS = 30;

async function createVersionSnapshot(
  chapterId: string,
  title: string,
  content: any[],
  authorId: string
) {
  const wordCount = countWordsInContent(content);
  const last = await ChapterVersion.findOne({ chapter: chapterId }).sort({ createdAt: -1 });
  if (last && last.title === title && JSON.stringify(last.content) === JSON.stringify(content)) {
    return;
  }

  await ChapterVersion.create({ chapter: chapterId, title, content, wordCount, author: authorId });

  const count = await ChapterVersion.countDocuments({ chapter: chapterId });
  if (count > MAX_VERSIONS) {
    const oldest = await ChapterVersion.find({ chapter: chapterId })
      .sort({ createdAt: 1 })
      .limit(count - MAX_VERSIONS)
      .select('_id');
    await ChapterVersion.deleteMany({ _id: { $in: oldest.map((v) => v._id) } });
  }
}

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chapter = await Chapter.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!chapter) {
      res.status(404).json({ message: '章节未找到' });
      return;
    }
    res.json(chapter);
  } catch {
    res.status(500).json({ message: '服务器错误' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, volume, order } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ message: '章名不能为空' });
      return;
    }
    if (!volume) {
      res.status(400).json({ message: '缺少 volume 参数' });
      return;
    }

    let chapOrder = order;
    if (chapOrder === undefined) {
      chapOrder = await Chapter.countDocuments({ volume, author: req.user!._id, ...notDeleted });
    }

    const chapter = await Chapter.create({
      title: title.trim(),
      volume,
      author: req.user!._id,
      order: chapOrder,
    });

    res.status(201).json(chapter);
  } catch {
    res.status(500).json({ message: '创建章节失败' });
  }
});

router.put('/reorder', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { volume, chapterIds } = req.body;
    if (!volume || !Array.isArray(chapterIds)) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    await Promise.all(
      chapterIds.map((id, idx) =>
        Chapter.findOneAndUpdate({ _id: id, volume, author: req.user!._id, ...notDeleted }, { order: idx })
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
      res.status(400).json({ message: '请选择要删除的章节' });
      return;
    }
    const now = new Date();
    await Chapter.updateMany({ _id: { $in: ids }, author: req.user!._id }, { deletedAt: now });
    res.json({ message: `已删除 ${ids.length} 个章节` });
  } catch {
    res.status(500).json({ message: '批量删除失败' });
  }
});

/**
 * GET /api/chapters/:id/versions
 */
router.get('/:id/versions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chapter = await Chapter.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!chapter) {
      res.status(404).json({ message: '章节未找到' });
      return;
    }

    const versions = await ChapterVersion.find({ chapter: chapter._id, author: req.user!._id })
      .select('title wordCount createdAt')
      .sort({ createdAt: -1 })
      .limit(MAX_VERSIONS);

    res.json(versions);
  } catch {
    res.status(500).json({ message: '获取版本历史失败' });
  }
});

/**
 * POST /api/chapters/:id/versions/:versionId/restore
 */
router.post('/:id/versions/:versionId/restore', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chapter = await Chapter.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!chapter) {
      res.status(404).json({ message: '章节未找到' });
      return;
    }

    const version = await ChapterVersion.findOne({
      _id: req.params.versionId,
      chapter: chapter._id,
      author: req.user!._id,
    });
    if (!version) {
      res.status(404).json({ message: '版本未找到' });
      return;
    }

    await createVersionSnapshot(chapter._id.toString(), chapter.title, chapter.content, req.user!._id.toString());

    chapter.title = version.title;
    chapter.content = version.content;
    await chapter.save();

    res.json(chapter);
  } catch {
    res.status(500).json({ message: '恢复版本失败' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, order, summary } = req.body;
    const chapter = await Chapter.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!chapter) {
      res.status(404).json({ message: '章节未找到' });
      return;
    }

    if (content !== undefined) {
      await createVersionSnapshot(
        chapter._id.toString(),
        chapter.title,
        chapter.content,
        req.user!._id.toString()
      );
      chapter.content = content;
    }
    if (title !== undefined) chapter.title = title;
    if (order !== undefined) chapter.order = order;
    if (summary !== undefined) chapter.summary = summary;

    await chapter.save();
    res.json(chapter);
  } catch {
    res.status(500).json({ message: '更新章节失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chapter = await Chapter.findOne({ _id: req.params.id, author: req.user!._id, ...notDeleted });
    if (!chapter) {
      res.status(404).json({ message: '章节未找到' });
      return;
    }
    chapter.deletedAt = new Date();
    await chapter.save();
    res.json({ message: '章节已删除' });
  } catch {
    res.status(500).json({ message: '删除章节失败' });
  }
});

export default router;
