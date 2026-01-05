import type { Request, Response, NextFunction } from "express";
import { superAdminModel } from "../models/superAdmin.model";
import jwt from "jsonwebtoken";

export const superAdminAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
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
    jwt.verify(token, jwtSecret, async (err, decoded) => {
        if (err || !decoded || typeof decoded === "string") {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const superAdmin = await superAdminModel.findById(decoded.userId);
        if (!superAdmin) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - Not a Super Admin",
            });
        }
        req.user = decoded; // Or req.superAdmin if we want to be specific, but types/express.d.ts uses user
        next();
    });
}
