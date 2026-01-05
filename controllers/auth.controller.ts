import type { Request, Response } from "express";
import { userModel } from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export class AuthController {
    static async register(req: Request, res: Response) {
        try {
            const { name, email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ success: false, message: "Email and password are required" });
            }

            const existingUser = await userModel.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "User already exists" });
            }

            const newUser = new userModel({ name, email, password });
            await newUser.save();

            return res.status(201).json({ success: true, message: "User registered successfully" });
        } catch (error) {
            console.error("Register error:", error);
            return res.status(500).json({ success: false, message: "Registration failed" });
        }
    }

    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ success: false, message: "Email and password are required" });
            }

            const user = await userModel.findOne({ email });
            if (!user) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                return res.status(500).json({ success: false, message: "Server configuration error" });
            }

            const token = jwt.sign(
                { userId: user._id, email: user.email },
                jwtSecret,
                { expiresIn: "24h" }
            );

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    credits: user.credits
                }
            });
        } catch (error) {
            console.error("Login error:", error);
            return res.status(500).json({ success: false, message: "Login failed" });
        }
    }

    static async me(req: Request, res: Response) {
        try {
            const user = req.user as any;
            if (!user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const userWithAgents = await userModel.findById(user._id).populate("agents");
            if (!userWithAgents) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            return res.status(200).json({
                success: true,
                user: {
                    id: userWithAgents._id,
                    name: userWithAgents.name,
                    email: userWithAgents.email,
                    agents: userWithAgents.agents,
                    credits: userWithAgents.credits
                }
            });
        } catch (error) {
            console.error("Me error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch user data" });
        }
    }
}
