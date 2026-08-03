import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

export interface IVolume extends MongoDoc {
  title: string;
  book: Types.ObjectId;
  author: Types.ObjectId;
  order: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const volumeSchema = new Schema<IVolume>(
  {
    title: {
      type: String,
      required: [true, '卷名是必填的'],
      trim: true,
      default: '新卷',
    },
    book: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
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
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

volumeSchema.index({ book: 1, order: 1 });

const Volume = mongoose.model<IVolume>('Volume', volumeSchema);
export default Volume;
