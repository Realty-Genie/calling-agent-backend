import mongoose from "mongoose";
import dotenv from "dotenv";
import { Lead } from "./models/Lead";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const TARGET_USER_ID = "695948cfbfe7ee9ddb1633c3"; // Pramit Manna's ID

async function assignLeads() {
    if (!MONGO_URI) {
        console.error("MONGO_URI not found in .env");
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const result = await Lead.updateMany(
            { userId: { $exists: false } },
            { $set: { userId: new mongoose.Types.ObjectId(TARGET_USER_ID) } }
        );

        console.log(`Successfully assigned ${result.modifiedCount} leads to user ${TARGET_USER_ID}`);

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

assignLeads();
