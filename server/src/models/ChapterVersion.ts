import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

export interface IChapterVersion extends MongoDoc {
  chapter: Types.ObjectId;
  title: string;
  content: any[];
  wordCount: number;
  author: Types.ObjectId;
  createdAt: Date;
}

const chapterVersionSchema = new Schema<IChapterVersion>(
  {
    chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: Schema.Types.Mixed, required: true },
    wordCount: { type: Number, default: 0 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chapterVersionSchema.index({ chapter: 1, createdAt: -1 });

const ChapterVersion = mongoose.model<IChapterVersion>('ChapterVersion', chapterVersionSchema);
export default ChapterVersion;
