import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { generateToken, protect, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Create a new user account.
 */
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage('Username must be 2-30 characters'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: errors.array()[0].msg });
      return;
    }

    try {
      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ message: 'Email already registered' });
        return;
      }

      const user = await User.create({ username, email, password });
      const token = generateToken(user._id);

      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        gender: user.gender,
        bio: user.bio,
        token,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * POST /api/auth/login
 * Log in with email and password.
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: errors.array()[0].msg });
      return;
    }

    try {
      const { email, password } = req.body;

      // Find user and explicitly select password
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }

      const token = generateToken(user._id);

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        gender: user.gender,
        bio: user.bio,
        token,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get the currently authenticated user's profile.
 */
router.get(
  '/me',
  protect,
  async (req: AuthRequest, res: Response): Promise<void> => {
    res.json({
      _id: req.user!._id,
      username: req.user!.username,
      email: req.user!.email,
      avatar: req.user!.avatar,
      gender: req.user!.gender,
      bio: req.user!.bio,
      createdAt: req.user!.createdAt,
    });
  }
);

/**
 * PUT /api/auth/profile
 * Update the authenticated user's profile.
 */
router.put(
  '/profile',
  protect,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { username, gender, bio, avatar } = req.body;

      const user = req.user!;

      if (username !== undefined) {
        if (username.trim().length < 2 || username.trim().length > 30) {
          res.status(400).json({ message: '昵称需要2-30个字符' });
          return;
        }
        user.username = username.trim();
      }
      if (gender !== undefined) {
        if (!['', '男', '女', '其他'].includes(gender)) {
          res.status(400).json({ message: '无效的性别选项' });
          return;
        }
        user.gender = gender;
      }
      if (bio !== undefined) {
        if (bio.length > 200) {
          res.status(400).json({ message: '个人签名最多200个字符' });
          return;
        }
        user.bio = bio;
      }
      if (avatar !== undefined) {
        user.avatar = avatar;
      }

      const updated = await user.save();

      res.json({
        _id: updated._id,
        username: updated.username,
        email: updated.email,
        avatar: updated.avatar,
        gender: updated.gender,
        bio: updated.bio,
        createdAt: updated.createdAt,
      });
    } catch (error) {
      res.status(500).json({ message: '更新资料失败' });
    }
  }
);

export default router;
