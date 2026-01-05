import mongoose from "mongoose";
import dotenv from "dotenv";
import { superAdminModel } from "./models/superAdmin.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";

async function createAdmin() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const email = "admin@callgenie.com";
        const password = "admin123";

        const existingAdmin = await superAdminModel.findOne({ email });
        if (existingAdmin) {
            console.log("Super Admin already exists");
            process.exit(0);
        }

        const newAdmin = new superAdminModel({ email, password });
        await newAdmin.save();

        console.log("Super Admin created successfully");
        console.log("Email:", email);
        console.log("Password:", password);

        process.exit(0);
    } catch (error) {
        console.error("Error creating admin:", error);
        process.exit(1);
    }
}

createAdmin();
