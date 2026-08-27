import mongoose from "mongoose";
import { env } from "./env.js";
import logger from "./logger.js";

export const connectMongo = async (): Promise<void> => {
  // mongoose.set("strictQuery", true);

  // let hasConnected = false;

  // mongoose.connection.on("disconnected", () => {
  //   if (!hasConnected) return; // Ignore initial disconnect before first successful connection
  //   logger.error(
  //     "MongoDB disconnected. Mongoose will attempt automatic reconnection."
  //   );
  // });

  // mongoose.connection.on("reconnected", () => {
  //   logger.info("MongoDB reconnected successfully.");
  // });

  // mongoose.connection.on("error", (err) => {
  //   logger.error("MongoDB connection error:", err.message);
  // });

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  // hasConnected = true;
  logger.info("MongoDB connected!");
}