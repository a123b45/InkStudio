import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

export interface IChapter extends MongoDoc {
  title: string;
  content: any[];
  volume: Types.ObjectId;
  author: Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const chapterSchema = new Schema<IChapter>(
  {
    title: {
      type: String,
      required: [true, '章名是必填的'],
      trim: true,
      default: '新章',
    },
    content: {
      type: Schema.Types.Mixed,
      default: [{ type: 'paragraph', children: [{ text: '' }] }],
    },
    volume: {
      type: Schema.Types.ObjectId,
      ref: 'Volume',
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

chapterSchema.index({ volume: 1, order: 1 });

const Chapter = mongoose.model<IChapter>('Chapter', chapterSchema);
export default Chapter;
