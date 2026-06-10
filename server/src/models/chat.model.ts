import mongoose, { Schema, Document } from "mongoose";

// ---------------------------------------------------------------------------
// Shape of a single message inside a chat session.
// role is used to match the Groq API convention. content is the raw message text.
// createdAt for timestamps per message.
// ---------------------------------------------------------------------------
export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Shape of the full chat session document.
// messages is an array of IChatMessage objects grown over time.
// ---------------------------------------------------------------------------
export interface IChatSession extends Document {
  userId: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: { 
        type: String, 
        enum: ["user", "assistant"], 
        required: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
  },
  { _id: false } // each message does not need its own MongoDB ObjectId. to save storage.
);

const chatSessionSchema = new Schema<IChatSession>(
  {
    userId: { 
        type: String, 
        required: true, 
        unique: true //this automatically creates a unique index on userId, ensuring one session per user and optimizing lookups by userId.
    },
    messages: { 
        type: [chatMessageSchema], 
        default: [] 
    },
  },
  { timestamps: true } // Mongoose automatically manages createdAt and updatedAt on the parent document.
);


export const ChatSession = mongoose.model<IChatSession>("ChatSession", chatSessionSchema);