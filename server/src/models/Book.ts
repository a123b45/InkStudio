import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

/**
 * Book model for the book management system.
 *
 * `content` is a JSON array matching Slate's `Descendant[]` type
 * for rich-text book content editing.
 */
export interface IBook extends MongoDoc {
  title: string;
  description: string;
  category: string;
  tags: string[];
  cover: string;
  content: any[];
  author: Types.ObjectId;
  isPublic: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: {
      type: String,
      required: [true, '书名是必填的'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    cover: {
      type: String,
      default: '',
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
      default: [
        {
          type: 'paragraph',
          children: [{ text: '' }],
        },
      ],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient filtering
bookSchema.index({ author: 1, category: 1 });
bookSchema.index({ author: 1, tags: 1 });

const Book = mongoose.model<IBook>('Book', bookSchema);
export default Book;
