import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

/**
 * Group model for organizing books into collections.
 *
 * `method` determines how books are auto-populated:
 *  - 'tags': books matching any of the configured tags
 *  - 'category': books matching the configured category
 *  - 'bookName': books whose title fuzzy-matches the search string
 *  - 'custom': manually managed book list
 */
export interface IGroup extends MongoDoc {
  name: string;
  method: 'tags' | 'category' | 'bookName' | 'custom';
  config: {
    tags?: string[];
    categories?: string[];
    bookName?: string;
  };
  books: Types.ObjectId[];
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: [true, '分组名称是必填的'],
      trim: true,
    },
    method: {
      type: String,
      required: true,
      enum: ['tags', 'category', 'bookName', 'custom'],
      default: 'custom',
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    books: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Book',
      },
    ],
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

groupSchema.index({ author: 1, name: 1 });

const Group = mongoose.model<IGroup>('Group', groupSchema);
export default Group;
