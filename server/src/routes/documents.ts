import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Document from '../models/Document';

const router = Router();

// All document routes require authentication
router.use(protect);

/**
 * GET /api/documents
 * Get all documents belonging to the authenticated user.
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const documents = await Document.find({ author: req.user!._id })
        .select('title updatedAt createdAt')
        .sort({ updatedAt: -1 });

      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * POST /api/documents
 * Create a new document for the authenticated user.
 */
router.post(
  '/',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, content } = req.body;

      const document = await Document.create({
        title: title || 'Untitled Document',
        content: content || [
          {
            type: 'paragraph',
            children: [{ text: '' }],
          },
        ],
        author: req.user!._id,
      });

      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * GET /api/documents/:id
 * Get a single document by ID (must belong to the user).
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const document = await Document.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!document) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }

      res.json(document);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * PUT /api/documents/:id
 * Update a document's title and/or content.
 */
router.put(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, content } = req.body;

      const document = await Document.findOne({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!document) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }

      if (title !== undefined) document.title = title;
      if (content !== undefined) document.content = content;

      const updated = await document.save();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * DELETE /api/documents/:id
 * Delete a document by ID (must belong to the user).
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const document = await Document.findOneAndDelete({
        _id: req.params.id,
        author: req.user!._id,
      });

      if (!document) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }

      res.json({ message: 'Document deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

export default router;
