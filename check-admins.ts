import mongoose from "mongoose";
import dotenv from "dotenv";
import { superAdminModel } from "./models/superAdmin.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";

async function checkAdmins() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const admins = await superAdminModel.find();
        console.log("Super Admins in DB:", JSON.stringify(admins.map(a => ({ email: a.email })), null, 2));

        process.exit(0);
    } catch (error) {
        console.error("Error checking admins:", error);
        process.exit(1);
    }
}

checkAdmins();
