import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

/**
 * A Slate document stored in MongoDB.
 *
 * `content` is a JSON array matching Slate's `Descendant[]` type:
 *   [{ type: 'paragraph', children: [{ text: 'Hello', bold: true }] }]
 */
export interface IDocument extends MongoDoc {
  title: string;
  content: any[]; // Slate Descendant[] — stored as Mixed for flexibility
  author: Types.ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      default: 'Untitled Document',
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
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

const Document = mongoose.model<IDocument>('Document', documentSchema);
export default Document;
