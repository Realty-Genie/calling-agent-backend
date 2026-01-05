import type { Request, Response } from "express";
import { Call } from "../models/Call";
import { Lead } from "../models/Lead";
import { EmailService } from "../services/email.service";
import { userModel } from "../models/user.model";

export class WebhookController {
    static async handleRetellWebhook(req: Request, res: Response) {
        try {
            const { event, call } = req.body;
            const call_id = call?.call_id;
            const call_analysis = call?.call_analysis;

            if (event !== "call_analyzed") {
                return res.status(200).json({ message: "Event ignored" });
            }

            if (!call_id || !call_analysis) {
                return res.status(400).json({ message: "Invalid payload" });
            }


            let callRecord;
            try {
                callRecord = await Call.findOne({ callId: call_id });
            } catch (error) {
                console.error("Database error finding call record:", error);
                return res.status(500).json({ message: "Database error" });
            }

            if (!callRecord) {
                return res.status(404).json({ message: "Call record not found" });
            }

            if (!callRecord.analysis) {
                callRecord.analysis = call_analysis;
            }

            try {
                await callRecord.save();
            } catch (error) {
                console.error("Database error saving call record:", error);
                // Continue with email sending even if save fails, or decide based on business logic
            }

            let lead;
            try {
                lead = await Lead.findById(callRecord.leadId);
            } catch (error) {
                console.error("Database error finding lead:", error);
                return res.status(500).json({ message: "Database error" });
            }

            if (!lead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            let user;
            try {
                user = await userModel.findById(lead.userId);
            } catch (error) {
                console.error("Database error finding user:", error);
                return res.status(500).json({ message: "Database error" });
            }

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const { custom_analysis_data } = call_analysis;

            try {
                // Send Report to User
                await EmailService.sendUserCallReport(user.email, lead.name, call_analysis);

                // Send Follow-up Info to User
                if (custom_analysis_data) {
                    await EmailService.sendLeadFollowUpInfoToUser(
                        user.email,
                        custom_analysis_data.name || lead.name,
                        custom_analysis_data.intent || "buy",
                        custom_analysis_data.follow_up_time || "soon",
                        custom_analysis_data.email || lead.email,
                        custom_analysis_data.phone_number || lead.phoneNumber
                    );
                }
            } catch (error) {
                console.error("Email service error:", error);
                // We might want to return 200 anyway if the webhook was received, 
                // but logging the error is crucial.
            }


            return res.status(200).json({ success: true, message: "Webhook processed successfully" });

        } catch (error) {
            console.error("Webhook processing error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to process webhook",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
