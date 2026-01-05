import type { Request, Response, NextFunction } from "express";
import { userModel } from "../models/user.model";
import jwt from "jsonwebtoken";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
    jwt.verify(token, jwtSecret, async (err, user) => {
        if (err || !user || typeof user === "string") {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const userFromDB = await userModel.findOne({ email: user.email });
        if (!userFromDB) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        req.user = userFromDB;
        next();
    });
}