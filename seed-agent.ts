import mongoose from "mongoose";
import dotenv from "dotenv";
import { agentModel } from "./models/agent.model";
import { userModel } from "./models/user.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";
const AGENT_ID = process.env.AGENT_ID;
const AGENT_PH_NUMBER = process.env.AGENT_PH_NUMBER;

async function seed() {
    try {
        if (!AGENT_ID || !AGENT_PH_NUMBER) {
            console.error("AGENT_ID and AGENT_PH_NUMBER must be set in .env");
            process.exit(1);
        }

        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Create or Update Agent
        let agent = await agentModel.findOne({ retellAgentId: AGENT_ID });
        if (!agent) {
            agent = new agentModel({
                name: "Default Agent",
                phoneNumber: AGENT_PH_NUMBER,
                retellAgentId: AGENT_ID
            });
            await agent.save();
            console.log("Created new agent:", agent._id);
        } else {
            console.log("Agent already exists:", agent._id);
        }

        // 2. Assign to User
        const userEmail = "pramitmanna19@gmail.com";
        const user = await userModel.findOne({ email: userEmail });
        if (user) {
            if (!user.agents.includes(agent._id as any)) {
                user.agents.push(agent._id as any);
                await user.save();
                console.log(`Assigned agent ${agent._id} to user ${userEmail}`);
            } else {
                console.log(`Agent ${agent._id} already assigned to user ${userEmail}`);
            }
        } else {
            console.error(`User ${userEmail} not found`);
        }

        process.exit(0);
    } catch (error) {
        console.error("Error seeding agent:", error);
        process.exit(1);
    }
}

seed();
