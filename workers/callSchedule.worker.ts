import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { Lead } from '../models/Lead';
import { connection } from '../queues/connection';
import { agentModel } from '../models/agent.model';
import { RetellService } from '../services/retell.services';
import { getCanadaDateContext } from "../utils/dateTime";

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not defined in environment variables");
    process.exit(1);
}

mongoose.connect(process.env.MONGO_URI as string)
    .then(() => console.log("MongoDB Connected in Worker"))
    .catch(err => console.error("MongoDB Connection Error:", err));

const worker = new Worker('call-schedule-queue', async (job) => {

    if (job.name === 'contact-lead') {
        console.log('contact-lead job');
        console.log(`Processing job with job ID: ${job.id}`);
        console.log(`Job data: ${JSON.stringify(job.data, null, 2)}`);

        // TODO: Realty Genie Call lead logic
        try {
            const phoneCallResponse = await RetellService.createPhoneCall({
                from_number: job.data.fromNumber,
                to_number: job.data.phNo,
                override_agent_id: process.env.AGENT_POC,
                metadata: job.data.metadata
            });
            console.log(phoneCallResponse);

        } catch (error) {
            console.error("Retell API error:", error);
        }

    } else if (job.name === 'call-schedule') {
        console.log('call-schedule-retell job');
        console.log(`Processing job with job ID: ${job.id}`);
        console.log(`Job data: ${JSON.stringify(job.data, null, 2)}`);

        const { metadata } = job.data;
        const leadId = metadata?.leadId;

        if (!leadId) {
            console.error("leadId missing in job metadata");
            return;
        }

        const lead = await Lead.findById(leadId);
        if (!lead) {
            console.error(`Lead not found with ID: ${leadId}`);
        } else {
            console.log("Lead found:", lead);
            const sellerAgent = metadata.sellerAgent;
            const agentId = metadata.agentId;

            const agent = await agentModel.findById(agentId);
            if (!agent) {
                console.error(`Agent not found with ID: ${agentId}`);
            } else {
                const retellAgentId = agent.retellAgentId;
                const fromNumber = job.data.fromNumber || agent.phoneNumber;
                if (!fromNumber) {
                    console.error(`Agent phone number not found or not configured for agent ID: ${agentId}`);
                }
                const dateContext = getCanadaDateContext();
                const dynamicVariables: any = {
                    name: lead.name,
                    email: lead.email,
                    phone_number: lead.phoneNumber,
                    today_day: dateContext.today_day,
                    today_date: dateContext.today_date,
                    today_iso: dateContext.today_iso,
                    timezone: dateContext.timezone,
                };
                console.log("Dynamic variables:", dynamicVariables);

                if (sellerAgent) {
                    dynamicVariables.address = lead.address;
                }

                try {
                    const phoneCallResponse = await RetellService.createPhoneCall({
                        from_number: fromNumber,
                        to_number: job.data.phNo,
                        override_agent_id: retellAgentId,
                        retell_llm_dynamic_variables: dynamicVariables,
                        metadata: metadata
                    });
                    console.log("Scheduled Phone call response initiated:", phoneCallResponse);
                } catch (e) {
                    console.error("Retell API error:", e);
                }
            }
        }
    } else {
        console.log("Invalid job name:", job.name);
    }


}, {
    connection,
    concurrency: 5,
}); 
