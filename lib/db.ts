import mongoose from 'mongoose';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

const mongodbUri = MONGODB_URI;

const cached: MongooseCache =
  global.mongooseCache ||
  (global.mongooseCache = {
    conn: null,
    promise: null,
  });

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongodbUri, {
        bufferCommands: false,
      })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}