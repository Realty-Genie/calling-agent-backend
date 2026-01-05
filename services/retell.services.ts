import Retell from "retell-sdk";
import dotenv from "dotenv";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
if (!RETELL_API_KEY) throw new Error("RETELL_API_KEY is not set");

const retellClient = new Retell({ apiKey: RETELL_API_KEY });

export class RetellService {
    static async createPhoneCall(params: any) {
        return await retellClient.call.createPhoneCall(params);
    }

    static async getCallDetails(callId: string) {
        return await retellClient.call.retrieve(callId);
    }

    static async createBatchCall(params: any) {
        return await retellClient.batchCall.createBatchCall(params);
    }
}
