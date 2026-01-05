import type { Request, Response } from "express";
import { RetellService } from "../services/retell.services";
import { agentModel } from "../models/agent.model";
import { Call } from "../models/Call";
import { Lead } from "../models/Lead";
import { getCanadaDateContext } from "../utils/dateTime";

export class CallController {
    static async initiateCall(req: Request, res: Response) {
        try {
            const { name, email, phoneNumber, subject, agentId } = req.body;
            const user = req.user as any;

            if (!name || !email || !phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: "name, email, and phoneNumber are required",
                });
            }

            let agentDoc;
            console.log("Initiating call. agentId from body:", agentId);
            console.log("Fallback AGENT_ID from env:", process.env.AGENT_ID);

            if (agentId) {
                try {
                    agentDoc = await agentModel.findById(agentId);
                    console.log("Found agent by ID:", agentDoc?._id);
                } catch (e) {
                    console.error("Error finding agent by ID:", e);
                }
            }

            if (!agentDoc && process.env.AGENT_ID) {
                agentDoc = await agentModel.findOne({ retellAgentId: process.env.AGENT_ID });
                console.log("Found agent by fallback ID:", agentDoc?._id);
            }

            if (!agentDoc) {
                console.error("Agent not found. agentId:", agentId, "env.AGENT_ID:", process.env.AGENT_ID);
                return res.status(404).json({ success: false, message: "Agent not found or not configured" });
            }

            // Check if user.agents includes agentDoc._id
            const userHasAccess = user.agents.some((id: any) => id.toString() === agentDoc._id.toString());
            if (!userHasAccess) {
                return res.status(403).json({ success: false, message: "Access denied to this agent" });
            }

            const retellAgentId = agentDoc.retellAgentId;

            // 1. Create or Update Lead
            let lead = await Lead.findOne({ email, userId: user._id });
            if (!lead) {
                lead = new Lead({ name, email, phoneNumber, userId: user._id });
                await lead.save();
            } else {
                lead.name = name;
                lead.phoneNumber = phoneNumber;
                await lead.save();
            }

            const dateContext = getCanadaDateContext();
            const fromNumber = process.env.AGENT_PH_NUMBER;
            if (!fromNumber) {
                return res.status(404).json({ success: false, message: "Agent phone number not found or not configured" });
            }
            console.log("Agent Phone number: ", fromNumber);
            const phoneCallResponse = await RetellService.createPhoneCall({
                from_number: fromNumber,
                to_number: phoneNumber,
                override_agent_id: retellAgentId,
                retell_llm_dynamic_variables: {
                    name,
                    email,
                    phone_number: phoneNumber,
                    subject: subject ?? "",
                    today_day: dateContext.today_day,
                    today_date: dateContext.today_date,
                    today_iso: dateContext.today_iso,
                    timezone: dateContext.timezone,
                },
            });

            // 2. Create Call Record
            try {
                const newCall = new Call({
                    callId: phoneCallResponse.call_id,
                    leadId: lead._id,
                    status: 'registered',
                });
                await newCall.save();
            } catch (error) {
                console.error("Failed to create call record:", error);
            }

            return res.status(200).json({
                success: true,
                message: "Call initiated successfully",
                data: phoneCallResponse,
            });

        } catch (error) {
            console.error("Initiate call error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to initiate call",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    static async getCallDetails(req: Request, res: Response) {
        try {
            const { callId } = req.params;
            if (!callId) {
                return res.status(400).json({
                    success: false,
                    message: "callId is required",
                });
            }

            const callRecordData = await Call.findOne({ callId });
            if (callRecordData && callRecordData.analysis) {
                const mappedData = {
                    call_id: callRecordData.callId,
                    call_status: callRecordData.status,
                    call_analysis: callRecordData.analysis,
                    transcript: callRecordData.transcript,
                    duration_ms: callRecordData.durationMs,
                    from_number: callRecordData.fromNumber,
                    to_number: callRecordData.toNumber,
                    call_cost: {
                        combined_cost: callRecordData.cost
                    },
                    recording_url: callRecordData.recordingUrl
                };

                return res.status(200).json({
                    success: true,
                    data: mappedData,
                });
            }

            const callResponse = await RetellService.getCallDetails(callId);

            const callRecord = await Call.findOne({ callId });
            if (callRecord) {
                callRecord.status = callResponse.call_status;
                callRecord.analysis = callResponse.call_analysis;
                callRecord.transcript = callResponse.transcript;
                callRecord.recordingUrl = callResponse.recording_url;
                callRecord.durationMs = callResponse.duration_ms;
                callRecord.cost = callResponse.call_cost?.combined_cost;

                if (callResponse.call_type === 'phone_call') {
                    callRecord.fromNumber = callResponse.from_number;
                    callRecord.toNumber = callResponse.to_number;
                }

                await callRecord.save();
            }

            return res.status(200).json({
                success: true,
                data: callResponse,
            });
        } catch (error) {
            console.error("Fetch call error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch call details" });
        }
    }

    static async createBatchCall(req: Request, res: Response) {
        const from_number = process.env.AGENT_PH_NUMBER;
        try {
            const { leads, trigger_timestamp, agentId } = req.body;
            const user = req.user as any;

            if (!from_number || !leads || !Array.isArray(leads) || leads.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "from_number and leads (non-empty array) are required",
                });
            }

            let agentDoc;
            if (agentId) {
                agentDoc = await agentModel.findById(agentId);
            } else if (process.env.AGENT_ID) {
                agentDoc = await agentModel.findOne({ retellAgentId: process.env.AGENT_ID });
            }

            if (!agentDoc) {
                return res.status(404).json({ success: false, message: "Agent not found or not configured" });
            }

            const userHasAccess = user.agents.some((id: any) => id.toString() === agentDoc._id.toString());
            if (!userHasAccess) {
                return res.status(403).json({ success: false, message: "Access denied to this agent" });
            }

            const retellAgentId = agentDoc.retellAgentId;


            const tasks = [];
            const dateContext = getCanadaDateContext();
            for (const leadData of leads) {
                const { name, email, phoneNumber } = leadData;

                if (!phoneNumber) continue;

                let lead = await Lead.findOne({ phoneNumber, userId: user._id });
                if (!lead) {
                    lead = new Lead({ name, email, phoneNumber, userId: user._id });
                    await lead.save();
                } else {
                    lead.name = name || lead.name;
                    lead.phoneNumber = phoneNumber;
                    await lead.save();
                }
                tasks.push({
                    to_number: phoneNumber,
                    override_agent_id: retellAgentId,
                    retell_llm_dynamic_variables: {
                        name,
                        email,
                        phone_number: phoneNumber,
                        ...dateContext
                    }
                });
            }

            if (tasks.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No valid leads provided",
                });
            }

            const batchCallResponse = await RetellService.createBatchCall({
                from_number,
                tasks,
                trigger_timestamp,
            });

            return res.status(201).json({
                success: true,
                message: "Batch call created successfully",
                data: batchCallResponse,
            });
        } catch (error) {
            console.error("Retell batch call error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to create batch call",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
