import type { Request, Response } from "express";
import { Lead } from "../models/Lead";
import { Call } from "../models/Call";

export class LeadController {
    static async bulkCreateLeads(req: Request, res: Response) {
        try {
            const { leads } = req.body;
            if (!leads || !Array.isArray(leads) || leads.length === 0) {
                return res.status(400).json({ success: false, message: "leads array is required" });
            }

            const user = req.user as any;
            const operations = leads.map(lead => ({
                updateOne: {
                    filter: { phoneNumber: lead.phoneNumber, userId: user._id },
                    update: { $set: { name: lead.name, email: lead.email, phoneNumber: lead.phoneNumber, userId: user._id } },
                    upsert: true
                }
            }));

            const result = await Lead.bulkWrite(operations);

            return res.status(200).json({
                success: true,
                message: `Successfully saved ${result.upsertedCount + result.modifiedCount} leads`,
                data: result
            });
        } catch (error) {
            console.error("Bulk save leads error:", error);
            return res.status(500).json({ success: false, message: "Failed to save leads" });
        }
    }

    static async deleteLead(req: Request, res: Response) {
        try {
            const user = req.user as any;
            const { phoneNumber } = req.params;
            const result = await Lead.deleteOne({ phoneNumber, userId: user._id });

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, message: "Lead not found" });
            }

            return res.status(200).json({ success: true, message: "Lead deleted successfully" });
        } catch (error) {
            console.error("Delete lead error:", error);
            return res.status(500).json({ success: false, message: "Failed to delete lead" });
        }
    }

    static async getLeads(req: Request, res: Response) {
        try {
            const user = req.user as any;
            if (!user || !user._id) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            const leads = await Lead.find({ userId: user._id }).sort({ createdAt: -1 }).lean();

            // For each lead, fetch their calls
            const leadsWithCalls = await Promise.all(leads.map(async (lead) => {
                const calls = await Call.find({ leadId: lead._id }).sort({ createdAt: -1 });
                return { ...lead, calls };
            }));

            return res.status(200).json({
                success: true,
                data: leadsWithCalls,
            });
        } catch (error) {
            console.error("Fetch leads error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch leads" });
        }
    }
}
