import mongoose from "mongoose";
import dotenv from "dotenv";
import { superAdminModel } from "./models/superAdmin.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";

async function updateAdmin() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const email = "admin@callgenie.com"; // The admin email you want to update
        const newPassword = "your_new_secure_password"; // Change this to your new password

        const admin = await superAdminModel.findOne({ email });
        if (!admin) {
            console.error("Super Admin not found");
            process.exit(1);
        }

        admin.password = newPassword;
        await admin.save();

        console.log("Super Admin password updated successfully");
        process.exit(0);
    } catch (error) {
        console.error("Error updating admin:", error);
        process.exit(1);
    }
}

updateAdmin();


// default credentials:
// Email: admin@callgenie.com
// Password: admin123 