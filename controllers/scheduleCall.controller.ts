import type { Request, Response } from "express";
import { ScheduleService } from "../services/schedule.service";

export class ScheduleCallController {
    static async scheduleCall(req: Request, res: Response) {
        try {
            const { phNo, delayTime, name, metadata, fromNumber } = req.body;
            const callerNumber = fromNumber || process.env.AGENT_PH_NUMBER;

            if (!callerNumber) {
                return res.status(400).json({ message: "fromNumber is required or AGENT_PH_NUMBER env var must be set." });
            }

            let result;

            try {
                if (metadata) {
                    result = await ScheduleService.scheduleCall(phNo, callerNumber, delayTime, name, metadata);

                } else {
                    result = await ScheduleService.scheduleCall(phNo, callerNumber, delayTime, name);

                }
            } catch (error: any) {
                console.error("Error scheduling call:", error);
                if (error.message === "Invalid time format. Could not parse natural language time." ||
                    error.message === "Schedule time is in the past" ||
                    error.message === "Invalid delay time format.") {
                    return res.status(400).json({ message: error.message });
                }
                return res.status(500).json({ message: "Failed to schedule call" });
            }

        } catch (error: any) {
            console.error("Error scheduling call:", error);
            if (error.message === "Invalid time format. Could not parse natural language time." ||
                error.message === "Schedule time is in the past" ||
                error.message === "Invalid delay time format.") {
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Failed to schedule call" });
        }
    }
}
