import mongoose from "mongoose";
import dotenv from "dotenv";
import { userModel } from "./models/user.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkUsers() {
    if (!MONGO_URI) {
        console.error("MONGO_URI not found in .env");
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const users = await userModel.find().lean();
        console.log("Users in DB:", JSON.stringify(users, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

checkUsers();
