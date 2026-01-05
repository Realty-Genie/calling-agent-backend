import mongoose from "mongoose";

const agentSchema = new mongoose.Schema({
    name: String,
    phoneNumber: {
        type: String,
        required: true,
    },
    retellAgentId: {
        type: String,
        required: true,
    }
});

export const agentModel = mongoose.model("AgentModel", agentSchema);