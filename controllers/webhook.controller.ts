import type { Request, Response } from "express";
import { Call } from "../models/Call";
import { Lead } from "../models/Lead";
import { EmailService } from "../services/email.service";
import { userModel } from "../models/user.model";
import { BatchCallModel } from "../models/batchCall.model";
import { generateReport } from "../utils/generateReport";
import { ScheduleService } from "../services/schedule.service";
import { compareSync } from "bcrypt";


export class WebhookController {
    static async handleRetellWebhook(req: Request, res: Response) {
        console.log("Webhook received");
        console.log(req.body);
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

            const batchCallId = call?.metadata?.batchCallId;
            const isBatchCallData = batchCallId ? true : false;
            const scheduleStatus = call_analysis?.custom_analysis_data?.need_scheduling;
            console.log("scheduleStatus", scheduleStatus);
            // console.log("typeof scheduleStatus", typeof scheduleStatus);
            const needScheduling = ((typeof scheduleStatus === 'boolean' && scheduleStatus === true) || (typeof scheduleStatus === 'string' && scheduleStatus.toLowerCase() === "true")) ? true : false;
            console.log("needScheduling", needScheduling);
            let leadId;
            if (isBatchCallData) {
                leadId = call?.metadata?.leadId;
                try {

                    if (needScheduling) {
                        const delay = call_analysis?.custom_analysis_data?.schedule_delay;
                        const leadDetail = await Lead.findById(leadId);
                        const leadName = leadDetail?.name || "";
                        const result = await ScheduleService.scheduleCall(call?.to_number, call?.from_number, delay, leadName, call?.metadata);
                        return res.status(200).json({ message: "Call scheduled successfully", delay, result });
                    }

                    const callRecord = new Call({
                        callId: call_id,
                        leadId: leadId,
                        analysis: call_analysis,
                        transcript: call?.transcript,
                        recordingUrl: call?.recording_url,
                        durationMs: call?.duration_ms,
                        cost: call?.cost,
                        fromNumber: call?.from_number,
                        toNumber: call?.to_number,
                        status: call?.call_status || "completed",
                        createdAt: new Date(),
                    });
                    try {
                        await callRecord.save();
                    } catch (e) {
                        console.error("Database error saving call record:", e);
                    }

                    const batchCall = await BatchCallModel.findOneAndUpdate(
                        { _id: batchCallId },
                        { $inc: { calls_done: 1 } },
                        { new: true }
                    );
                    if (batchCall && batchCall.calls_done === batchCall.expected_calls) {
                        await BatchCallModel.updateOne({ _id: batchCallId }, { status: "completed" });

                        const report = await generateReport(batchCallId);
                        console.log("Batch call completed");
                        console.log(`report: ${JSON.stringify(report, null, 2)}`);

                        try {
                            const user = await userModel.findById(batchCall.realtorId);
                            if (user) {
                                await EmailService.sendBatchCallReport(user.email, report);
                                console.log(`Batch report email sent to ${user.email}`);
                            } else {
                                console.error("User not found for batch call report email");
                            }
                        } catch (emailError) {
                            console.error("Error sending batch report email:", emailError);
                        }
                    }
                    return res.status(200).json({ success: true, message: "Webhook processed successfully" });

                } catch (e) {
                    console.error("Database error saving call record for batch call:", e);
                }
            }

            let callRecord;
            try {
                callRecord = await Call.findOne({ callId: call_id });
                leadId = callRecord?.leadId;
            } catch (error) {
                console.error("Database error finding call record:", error);
                return res.status(500).json({ message: "Database error" });
            }

            if (!callRecord) {
                return res.status(404).json({ message: "Call record not found" });
            }

            if (needScheduling) {
                const delay = call_analysis?.custom_analysis_data?.schedule_delay;
                const leadDetail = await Lead.findById(leadId);
                const leadName = leadDetail?.name || "";
                try {
                    const result = await ScheduleService.scheduleCall(call?.to_number, call?.from_number, delay, leadName, call?.metadata);
                    return res.status(200).json({ message: "Call scheduled successfully", delay, result });
                } catch (e) {
                    console.log(`Error scheduling call: ${e}`);
                }
            }

            callRecord.analysis = call_analysis;
            callRecord.transcript = call?.transcript;
            callRecord.recordingUrl = call?.recording_url;
            callRecord.durationMs = call?.duration_ms;
            callRecord.status = call?.call_status;
            callRecord.cost = call?.cost;
            callRecord.fromNumber = call?.from_number;
            callRecord.toNumber = call?.to_number;

            try {
                await callRecord.save();
            } catch (error) {
                console.error("Database error saving call record:", error);
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

                await EmailService.sendUserCallReport(user.email, lead.name, call_analysis);

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
                return res.status(500).json({ success: false, message: "Failed to send email" });
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
