import { Router } from "express";
import { RetellService } from "../services/retell.services";
import { getCanadaDateContext } from "../utils/dateTime";
import { PlatformLead } from '../models/platformLead.model'
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { OtpModel } from "../models/otp.model";
import { EmailService } from "../services/email.service";
import type { Request, Response } from "express";

const router = Router();

const limiter = rateLimit({
    windowMs: 120 * 60 * 1000,
    limit: 6,
    message: "Too many calls from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
});

class OTPServices {

    static async generateOtp(req: Request, res: Response) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ message: "Email is required" });
            }

            const user = await PlatformLead.findOneAndUpdate(
                { email },
                { $setOnInsert: { email, trialLeft: 5 } },
                { upsert: true, new: true }
            );


            const otp = Math.floor(100000 + Math.random() * 900000);

            await OtpModel.findOneAndUpdate(
                { email },
                {
                    otp,
                    email,
                    leadId: user._id,
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                },
                { upsert: true, new: true }
            );
            await EmailService.sendMailForOTP(email, "OTP for Verification", `Your verification code for CallGenie is ${otp}`);

            return res.status(200).json({
                message: "If email exists, OTP sent"
            });

        } catch (e: any) {
            return res.status(500).json({
                message: "Failed to generate OTP",
                error: e
            });
        }
    }
    static async verifyOtp(req: Request, res: Response) {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return res.status(400).json({
                    message: "Email and otp are required"
                });
            }

            const user = await PlatformLead.findOne({ email });

            if (!user) {
                return res.status(400).json({
                    message: "Invalid email or OTP"
                });
            }

            const storedOtp = await OtpModel.findOne({
                email,
                otp: Number(otp),
                expiresAt: { $gt: new Date() },
            });

            if (!storedOtp) {
                return res.status(400).json({
                    message: "Otp invalid or expired"
                });
            }

            await OtpModel.deleteOne({ _id: storedOtp._id });

            const token = jwt.sign(
                { email },
                process.env.JWT_SECRET || "secret",
                { expiresIn: "10m" }
            );

            return res.status(200).json({
                message: "Otp verified successfully",
                token
            });

        } catch (e) {
            return res.status(500).json({
                message: "Failed to verify OTP"
            });
        }
    }
}

router.post("/createCall", limiter, async (req, res) => {
    try {
        const { name, email, toNumber, fromNumber, retellAgentId, token } = req.body;
        if (!name || !email || !toNumber || !fromNumber || !retellAgentId || !token) {
            return res.status(400).json({
                success: false,
                message: "name, email, toNumber, fromNumber, retellAgentId, and token are required",
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as { email: string };
            if (decoded.email !== email) {
                return res.status(401).json({ success: false, message: "Token email mismatch" });
            }
        } catch {
            return res.status(401).json({ success: false, message: "Invalid or expired token" });
        }
        const updatedLead = await PlatformLead.findOneAndUpdate(
            { email, phoneNumber: toNumber, trialLeft: { $gt: 0 } },
            { $inc: { trialLeft: -1 } },
            { new: true }
        );

        if (updatedLead) {
            console.log("Lead already exists");
        } else {
            const existingLead = await PlatformLead.findOne({ email, phoneNumber: toNumber });
            if (existingLead) {
                return res.status(400).json({
                    success: false,
                    message: "Trial limit reached, Please contact us for more usage",
                });
            } else {
                try {
                    const newLeadForPlatform = new PlatformLead({ name, email, phoneNumber: toNumber, trialLeft: 5 });
                    await newLeadForPlatform.save();
                } catch (error: any) {
                    if (error.code === 11000) {
                        const retryUpdate = await PlatformLead.findOneAndUpdate(
                            { email, phoneNumber: toNumber, trialLeft: { $gt: 0 } },
                            { $inc: { trialLeft: -1 } },
                            { new: true }
                        );
                        if (!retryUpdate) {
                            const checkLead = await PlatformLead.findOne({ email, phoneNumber: toNumber });
                            if (checkLead && checkLead.trialLeft === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Trial limit reached, Please contact us for more usage",
                                });
                            }
                        }
                    } else {
                        throw error;
                    }
                }
            }
        }
        let phoneCallResponse;
        const dateContext = getCanadaDateContext();
        try {
            const dynamicVariables: any = {
                name,
                email,
                phone_number: toNumber,
                today_day: dateContext.today_day,
                today_date: dateContext.today_date,
                today_iso: dateContext.today_iso,
                timezone: dateContext.timezone,
            };
            phoneCallResponse = await RetellService.createPhoneCall({
                from_number: fromNumber,
                to_number: toNumber,
                override_agent_id: retellAgentId,
                retell_llm_dynamic_variables: dynamicVariables,
            });
            res.status(200).json({ success: true, message: "Call initiated successfully", data: phoneCallResponse });
        } catch (error) {
            console.error("Retell API error:", error);
            return res.status(500).json({ success: false, message: "Failed to initiate call with Retell" });
        }
    } catch (error) {
        console.error("Error creating call:", error);
        res.status(500).json({ success: false, message: "Failed to create call" });
    }
});

router.post("/verifyEmail", OTPServices.generateOtp);
router.post("/verifyOtp", OTPServices.verifyOtp);


export default router;