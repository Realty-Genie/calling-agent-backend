import type { Request, Response } from "express";
import mongoose from "mongoose";

import { RetellService } from "../services/retell.services";
import { agentModel } from "../models/agent.model";
import { BatchCallModel } from "../models/batchCall.model";
import { Call } from "../models/Call";
import { Lead } from "../models/Lead";
import { getCanadaDateContext } from "../utils/dateTime";

export class CallController {
    static async initiateCall(req: Request, res: Response) {
        try {
            const { name, email, phoneNumber, subject, agentId, address } = req.body;
            const user = req.user as any;

            if (!name || !phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: "name, and phoneNumber are required",
                });
            }

            let agentDoc;
            if (agentId) {
                try {
                    agentDoc = await agentModel.findById(agentId);
                } catch (e) {
                    console.error("Error finding agent by ID:", e);
                }
            }

            if (!agentDoc && process.env.AGENT_ID) {
                try {
                    agentDoc = await agentModel.findOne({ retellAgentId: process.env.AGENT_ID });
                } catch (e) {
                    console.error("Error finding agent by fallback ID:", e);
                }
            }

            if (!agentDoc) {
                return res.status(404).json({ success: false, message: "Agent not found or not configured" });
            }

            const userHasAccess = user.agents.some((id: any) => id.toString() === agentDoc._id.toString());
            if (!userHasAccess) {
                return res.status(403).json({ success: false, message: "Access denied to this agent" });
            }

            const retellAgentId = agentDoc.retellAgentId;
            const isSellerAgent = agentDoc.name.toLowerCase().includes("seller");

            if (isSellerAgent && !address) {
                return res.status(400).json({
                    success: false,
                    message: "Address is required for seller agents",
                });
            }
            const leadType = isSellerAgent ? "seller" : "buyer";
            let lead;
            try {
                lead = await Lead.findOne({ email, userId: user._id });
                if (!lead) {
                    lead = new Lead({ name, email, phoneNumber, userId: user._id, type: leadType, address: address });
                    await lead.save();
                } else {
                    lead.name = name;
                    lead.phoneNumber = phoneNumber;
                    lead.address = address;
                    await lead.save();
                }
            } catch (error) {
                console.error("Database error handling lead:", error);
                return res.status(500).json({ success: false, message: "Database error" });
            }

            const dateContext = getCanadaDateContext();
            const fromNumber = agentDoc.phoneNumber || process.env.AGENT_PH_NUMBER;
            if (!fromNumber) {
                return res.status(404).json({ success: false, message: "Agent phone number not found or not configured" });
            }

            let phoneCallResponse;
            try {
                const dynamicVariables: any = {
                    name,
                    email,
                    phone_number: phoneNumber,
                    subject: subject ?? "",
                    today_day: dateContext.today_day,
                    today_date: dateContext.today_date,
                    today_iso: dateContext.today_iso,
                    timezone: dateContext.timezone,
                };

                if (isSellerAgent) {
                    dynamicVariables.address = address;
                }

                phoneCallResponse = await RetellService.createPhoneCall({
                    from_number: fromNumber,
                    to_number: phoneNumber,
                    override_agent_id: retellAgentId,
                    retell_llm_dynamic_variables: dynamicVariables,
                    metadata: {
                        sellerAgent: isSellerAgent ? true : false,
                        agentId: agentId,
                        leadId: lead._id
                    },
                });
            } catch (error) {
                console.error("Retell API error:", error);
                return res.status(500).json({ success: false, message: "Failed to initiate call with Retell" });
            }

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

            let callRecordData;
            try {
                callRecordData = await Call.findOne({ callId });
            } catch (error) {
                console.error("Database error finding call record:", error);
            }

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

            let callResponse;
            try {
                callResponse = await RetellService.getCallDetails(callId);
            } catch (error) {
                console.error("Retell API error fetching call details:", error);
                return res.status(500).json({ success: false, message: "Failed to fetch call details from Retell" });
            }

            if (callRecordData) {
                try {
                    callRecordData.status = callResponse.call_status;
                    callRecordData.analysis = callResponse.call_analysis;
                    callRecordData.transcript = callResponse.transcript;
                    callRecordData.recordingUrl = callResponse.recording_url;
                    callRecordData.durationMs = callResponse.duration_ms;
                    callRecordData.cost = callResponse.call_cost?.combined_cost;

                    if (callResponse.call_type === 'phone_call') {
                        callRecordData.fromNumber = callResponse.from_number;
                        callRecordData.toNumber = callResponse.to_number;
                    }

                    await callRecordData.save();
                } catch (error) {
                    console.error("Database error updating call record:", error);
                }
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
        try {
            const { leads, trigger_timestamp, agentId } = req.body;
            const user = req.user as any;

            if (!leads || !Array.isArray(leads) || leads.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "leads (non-empty array) are required",
                });
            }

            let agentDoc;
            if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
                try {
                    agentDoc = await agentModel.findById(agentId);
                } catch (e) {
                    console.error("Error finding agent by ID:", e);
                }
            }

            if (!agentDoc && process.env.AGENT_ID) {
                try {
                    agentDoc = await agentModel.findOne({ retellAgentId: process.env.AGENT_ID });
                } catch (e) {
                    console.error("Error finding agent by fallback ID:", e);
                }
            }

            if (!agentDoc) {
                return res.status(404).json({ success: false, message: "Agent not found or not configured" });
            }

            const batchCall = new BatchCallModel({
                realtorId: user._id,
                agentId: agentDoc._id,
                expected_calls: leads.length,
            });
            await batchCall.save();
            const batchCallId = batchCall._id;

            const from_number = agentDoc.phoneNumber || process.env.AGENT_PH_NUMBER;

            if (!from_number) {
                return res.status(404).json({ success: false, message: "Agent phone number not found or not configured" });
            }

            const userHasAccess = user.agents.some((id: any) => id.toString() === agentDoc._id.toString());
            if (!userHasAccess) {
                return res.status(403).json({ success: false, message: "Access denied to this agent" });
            }

            const retellAgentId = agentDoc.retellAgentId;
            const isSellerAgent = agentDoc.name.toLowerCase().includes("seller");

            const tasks = [];
            const leadIds = [];
            const leadTypes = isSellerAgent ? "seller" : "buyer";
            const dateContext = getCanadaDateContext();
            for (const leadData of leads) {
                const { name, email, phoneNumber, address } = leadData;

                if (!phoneNumber) continue;
                if (isSellerAgent && !address) {
                    // Skip or log error? For batch, maybe we should skip invalid ones or just proceed without address?
                    // User said "mandatory fields", so we should probably skip or error.
                    // Let's skip for now to avoid crashing the whole batch, but maybe logging would be better.
                    // Or we can just let it fail at Retell if we wanted, but we are constructing the payload here.
                    // Given the strict requirement, let's skip leads without address for seller agents.
                    console.warn(`Skipping lead ${phoneNumber} because address is missing for seller agent.`);
                    continue;
                }

                try {
                    let lead = await Lead.findOne({ phoneNumber, userId: user._id });
                    if (!lead) {
                        lead = new Lead({ name, email, phoneNumber, userId: user._id, type: leadTypes });
                        await lead.save();
                    } else {
                        lead.name = name || lead.name;
                        lead.phoneNumber = phoneNumber;
                        lead.type = leadTypes;
                        await lead.save();
                    }

                    const dynamicVariables: any = {
                        name,
                        email,
                        phone_number: phoneNumber,
                        ...dateContext
                    };

                    if (isSellerAgent) {
                        dynamicVariables.address = address;
                    }
                    leadIds.push(lead._id);
                    tasks.push({
                        to_number: phoneNumber,
                        override_agent_id: retellAgentId,
                        metadata: {
                            batchCallId: batchCallId,
                            leadId: lead._id,
                            sellerAgent: isSellerAgent ? true : false,
                            agentId: agentId
                        },
                        retell_llm_dynamic_variables: dynamicVariables
                    });
                } catch (error) {
                    console.error("Database error handling lead in batch:", error);
                }
            }

            batchCall.leadIds = leadIds;
            try {
                await batchCall.save();
            } catch (e) {
                console.error("Database error saving batch call:", e);
                return res.status(500).json({ success: false, message: "Failed to save leads in batch call" });
            }

            if (tasks.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No valid leads provided (check if address is present for seller agents)",
                });
            }

            let batchCallResponse;
            try {
                batchCallResponse = await RetellService.createBatchCall({
                    from_number,
                    tasks,
                    trigger_timestamp,
                });
            } catch (error) {
                console.error("Retell API error creating batch call:", error);
                return res.status(500).json({ success: false, message: "Failed to create batch call with Retell" });
            }

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
