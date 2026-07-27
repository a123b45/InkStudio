import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  const mongoURI =
    process.env.MONGO_URI ||
    'mongodb://appuser:app123@localhost:27017/slate-mern-app?authSource=admin';

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error}`);
    process.exit(1);
  }
};

export default connectDB;
