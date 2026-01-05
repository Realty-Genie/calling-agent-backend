import type { Request, Response } from "express";
import { superAdminModel } from "../models/superAdmin.model";
import { agentModel } from "../models/agent.model";
import { userModel } from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export class AdminController {
    static async register(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ success: false, message: "Email and password are required" });
            }

            const existingAdmin = await superAdminModel.findOne({ email });
            if (existingAdmin) {
                return res.status(400).json({ success: false, message: "Super Admin already exists" });
            }

            const newAdmin = new superAdminModel({ email, password });
            await newAdmin.save();

            return res.status(201).json({ success: true, message: "Super Admin registered successfully" });
        } catch (error) {
            console.error("Admin register error:", error);
            return res.status(500).json({ success: false, message: "Registration failed" });
        }
    }

    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ success: false, message: "Email and password are required" });
            }

            const admin = await superAdminModel.findOne({ email });
            if (!admin) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }

            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                return res.status(500).json({ success: false, message: "Server configuration error" });
            }

            const token = jwt.sign(
                { userId: admin._id, email: admin.email, role: 'superadmin' },
                jwtSecret,
                { expiresIn: "24h" }
            );

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token
            });
        } catch (error) {
            console.error("Admin login error:", error);
            return res.status(500).json({ success: false, message: "Login failed" });
        }
    }

    static async addAgent(req: Request, res: Response) {
        try {
            const { name, phoneNumber, retellAgentId } = req.body;

            if (!phoneNumber || !retellAgentId) {
                return res.status(400).json({ success: false, message: "phoneNumber and retellAgentId are required" });
            }

            const existingAgent = await agentModel.findOne({ retellAgentId });
            if (existingAgent) {
                return res.status(400).json({ success: false, message: "Agent with this Retell ID already exists" });
            }

            const newAgent = new agentModel({
                name,
                phoneNumber,
                retellAgentId
            });

            await newAgent.save();

            return res.status(201).json({
                success: true,
                message: "Agent added successfully",
                data: newAgent
            });

        } catch (error) {
            console.error("Add agent error:", error);
            return res.status(500).json({ success: false, message: "Failed to add agent" });
        }
    }

    static async assignAgentToUser(req: Request, res: Response) {
        try {
            const { userEmail, agentId } = req.body;

            if (!userEmail || !agentId) {
                return res.status(400).json({ success: false, message: "userEmail and agentId are required" });
            }

            const user = await userModel.findOne({ email: userEmail });
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            const agent = await agentModel.findById(agentId);
            if (!agent) {
                return res.status(404).json({ success: false, message: "Agent not found" });
            }

            if (!user.agents.includes(agent._id as any)) {
                user.agents.push(agent._id as any);
                await user.save();
            }

            return res.status(200).json({
                success: true,
                message: "Agent assigned to user successfully"
            });
        } catch (error) {
            console.error("Assign agent error:", error);
            return res.status(500).json({ success: false, message: "Failed to assign agent" });
        }
    }

    static async getUsers(req: Request, res: Response) {
        try {
            const users = await userModel.find().populate('agents').sort({ createdAt: -1 });
            return res.status(200).json({
                success: true,
                data: users
            });
        } catch (error) {
            console.error("Get users error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch users" });
        }
    }

    static async getAgents(req: Request, res: Response) {
        try {
            const agents = await agentModel.find().sort({ createdAt: -1 });
            return res.status(200).json({
                success: true,
                data: agents
            });
        } catch (error) {
            console.error("Get agents error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch agents" });
        }
    }

    static async updateUserCredits(req: Request, res: Response) {
        try {
            const { userId, credits } = req.body;

            if (!userId || credits === undefined) {
                return res.status(400).json({ success: false, message: "userId and credits are required" });
            }

            const user = await userModel.findByIdAndUpdate(
                userId,
                { $set: { credits } },
                { new: true }
            );

            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            return res.status(200).json({
                success: true,
                message: "Credits updated successfully",
                data: user
            });
        } catch (error) {
            console.error("Update credits error:", error);
            return res.status(500).json({ success: false, message: "Failed to update credits" });
        }
    }

    static async removeAgentFromUser(req: Request, res: Response) {
        try {
            const { userId, agentId } = req.body;

            if (!userId || !agentId) {
                return res.status(400).json({ success: false, message: "userId and agentId are required" });
            }

            const user = await userModel.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            user.agents = user.agents.filter(id => id.toString() !== agentId);
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Agent removed from user successfully"
            });
        } catch (error) {
            console.error("Remove agent error:", error);
            return res.status(500).json({ success: false, message: "Failed to remove agent" });
        }
    }
}
