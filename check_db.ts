import mongoose from "mongoose";
import dotenv from "dotenv";
import { Lead } from "./models/Lead";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";

async function checkLeads() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const totalLeads = await Lead.countDocuments();
        const leadsWithoutUserId = await Lead.countDocuments({ userId: { $exists: false } });
        const leadsWithNullUserId = await Lead.countDocuments({ userId: null });

        console.log(`Total leads: ${totalLeads}`);
        console.log(`Leads without userId field: ${leadsWithoutUserId}`);
        console.log(`Leads with null userId: ${leadsWithNullUserId}`);

        if (totalLeads > 0) {
            const sampleLeads = await Lead.find().limit(5).lean();
            console.log("Sample leads:", JSON.stringify(sampleLeads, null, 2));
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

checkLeads();
