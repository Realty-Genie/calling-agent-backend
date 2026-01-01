import express from "express";
import Retell from "retell-sdk";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import { Lead } from "./models/Lead.js";
import { Call } from "./models/Call.js";
import { getCanadaDateContext } from "./utils/dateTime.js";


dotenv.config();

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const RETELL_API_KEY = process.env.RETELL_API_KEY;
if (!RETELL_API_KEY) throw new Error("RETELL_API_KEY is not set");

const AGENT_ID = process.env.AGENT_ID;
if (!AGENT_ID) throw new Error("AGENT_ID is not set");

const retellClient = new Retell({ apiKey: RETELL_API_KEY });


/**
 * POST /call-lead
 */
app.post("/call-lead", async (req, res) => {
  try {
    const { name, email, phoneNumber, subject } = req.body;
    if (!name || !email || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "name, email, and phoneNumber are required",
      });
    }

    // 1. Create or Update Lead
    let lead = await Lead.findOne({ email });
    if (!lead) {
      lead = new Lead({ name, email, phoneNumber });
      await lead.save();
    } else {
      // Update phone/name if changed? For now just use existing lead
      lead.name = name;
      lead.phoneNumber = phoneNumber;
      await lead.save();
    }

    const dateContext = getCanadaDateContext();

    const phoneCallResponse = await retellClient.call.createPhoneCall({
      from_number: "+14385331002",
      to_number: phoneNumber,
      override_agent_id: AGENT_ID,

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
    console.log("Phone call response:", phoneCallResponse);

    // 2. Create Call Record
    try {
      const newCall = new Call({
        callId: phoneCallResponse.call_id,
        leadId: lead._id,
        status: 'registered',
      });
      console.log("New call record:", newCall);
      await newCall.save();
    } catch (error) {
      console.error("Failed to create call record:", error);
    }

    console.log("Phone call response:", phoneCallResponse);

    return res.status(200).json({
      success: true,
      message: "Call initiated successfully",
      data: phoneCallResponse,
    });
  } catch (error) {
    console.error("Retell call error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to initiate call",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /leads/bulk
 * Save multiple leads to the database
 */
app.post("/leads/bulk", async (req, res) => {
  try {
    const { leads } = req.body;
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, message: "leads array is required" });
    }

    const operations = leads.map(lead => ({
      updateOne: {
        filter: { phoneNumber: lead.phoneNumber },
        update: { $set: { name: lead.name, email: lead.email, phoneNumber: lead.phoneNumber } },
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
});

/**
 * DELETE /leads/:phoneNumber
 * Delete a lead by phone number
 */
app.delete("/leads/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "phoneNumber is required" });
    }

    const result = await Lead.deleteOne({ phoneNumber });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    return res.status(200).json({ success: true, message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Delete lead error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete lead" });
  }
});

/**
 * GET /leads
 * Fetch all leads with their latest calls
 */
app.get("/leads", async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).lean();

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
});

/**
 * GET /call/:callId
 * Fetch call details from Retell and update DB
 */
app.get("/call/:callId", async (req, res) => {
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
      console.log("Call record data found in DB:", callRecordData.callId);

      // Map DB fields to match Retell SDK response structure expected by frontend
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
    // 1. Fetch from Retell
    const callResponse = await retellClient.call.retrieve(callId);

    // 2. Update DB
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
});

// ... (batch call endpoint)

/**
 * POST /create-batch-call
 * Body:
 * {
 *   "from_number": "+14157774444",
 *   "numbers": ["+12137774445", "+15556667777"],
 *   "name": "Optional Name",
 *   "trigger_timestamp": 1234567890
 * }
 */
app.post("/create-batch-call", async (req, res) => {
  const from_number = "+14385331002";
  try {
    const { leads, trigger_timestamp } = req.body;

    if (!from_number || !leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "from_number and leads (non-empty array) are required",
      });
    }

    // 1. Process Leads (Save/Update in DB)
    const tasks = [];
    const dateContext = getCanadaDateContext();
    for (const leadData of leads) {
      const { name, email, phoneNumber } = leadData;

      if (!phoneNumber) continue; // Skip invalid leads

      let lead = await Lead.findOne({ phoneNumber });
      if (!lead) {
        lead = new Lead({ name, email, phoneNumber });
        await lead.save();
      } else {
        lead.name = name || lead.name;
        lead.phoneNumber = phoneNumber;
        await lead.save();
      }
      tasks.push({
        to_number: phoneNumber,
        override_agent_id: AGENT_ID,
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

    const batchCallResponse = await retellClient.batchCall.createBatchCall({
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
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📞 Retell Call API running on port ${PORT}`);
});
