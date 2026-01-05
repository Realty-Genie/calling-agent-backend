import mongoose from "mongoose";
import dotenv from "dotenv";
import { agentModel } from "./models/agent.model";
import { userModel } from "./models/user.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";

async function checkDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const agents = await agentModel.find();
        console.log("Agents in DB:", JSON.stringify(agents, null, 2));

        const users = await userModel.find();
        console.log("Users in DB:", JSON.stringify(users.map(u => ({ email: u.email, agents: u.agents })), null, 2));

        process.exit(0);
    } catch (error) {
        console.error("Error checking DB:", error);
        process.exit(1);
    }
}

checkDB();
