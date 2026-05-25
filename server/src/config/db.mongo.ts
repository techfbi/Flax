import mongoose from "mongoose";
import { env } from "./env.js";

export const connectMongo = async (): Promise<void> => {
  // mongoose.set("strictQuery", true);

  // let hasConnected = false;

  // mongoose.connection.on("disconnected", () => {
  //   if (!hasConnected) return; // Ignore initial disconnect before first successful connection
  //   console.error( 
  //     "[REMOVE LOG LATER] MongoDB disconnected. Mongoose will attempt automatic reconnection."
  //   );
  // });

  // mongoose.connection.on("reconnected", () => {
  //   console.log("[REMOVE LOG LATER] MongoDB reconnected successfully.");
  // });

  // mongoose.connection.on("error", (err) => {
  //   console.error("[REMOVE LOG LATER] MongoDB connection error:", err.message);
  // });

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  // hasConnected = true;
  console.log("MongoDB connected!");
}