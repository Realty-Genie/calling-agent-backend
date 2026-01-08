import { BatchCallModel } from "../models/batchCall.model";
import { Call } from "../models/Call";
import { Lead } from "../models/Lead";


export const generateReport = async (batchCallId: string) => {
    const report: Record<string, any> = {};

    const BatchDetails = await BatchCallModel.findById(batchCallId);
    const leadsOfBatchCall = BatchDetails?.leadIds || [];

    const [leads, calls] = await Promise.all([
        Lead.find({ _id: { $in: leadsOfBatchCall } }),
        Call.find({ leadId: { $in: leadsOfBatchCall } })
    ]);

    const callMap = new Map();
    calls.forEach(call => {
        callMap.set(call.leadId.toString(), call);
    });

    for (const leadDetails of leads) {
        const phNo = leadDetails.phoneNumber;
        const call = callMap.get(leadDetails._id.toString());
        const leadType = leadDetails.type;

        const reportData = {
            callDetails: {
                analysis: call?.analysis?.call_summary,
                status: call?.status,
                semtiment: call?.analysis?.user_sentiment,
                followUp: call?.analysis?.custom_analysis_data?.["Preferred Follow-Up Time & Days"],
            } as Record<string, any>,
            leadDetails: {
                name: leadDetails.name,
                email: leadDetails.email,
                phoneNumber: leadDetails.phoneNumber,
                leadType
            } as Record<string, any>
        };

        if (leadType === "seller") {
            reportData.leadDetails.address = leadDetails.address;
            reportData.callDetails.Appointment = call?.analysis?.custom_analysis_data?.["Appointment Details"] || null;
        }
        report[phNo || ""] = reportData;
    }
    return report;
}