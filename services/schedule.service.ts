import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { callScheduleQueue } from '../queues/call-schedule.queue';
import { parseNaturalLanguageTime } from '../utils/dateTime';

dayjs.extend(utc);
dayjs.extend(timezone);

export class ScheduleService {
    static async scheduleCall(phNo: string, fromNumber: string, delayTime: string | number, name: string, metadata: any = "") {
        let scheduledDate: dayjs.Dayjs;
        let delay: number;

        const delayMinutes = Number(delayTime);

        if (!isNaN(delayMinutes) && delayMinutes > 0) {
            const nowVancouver = dayjs().tz("America/Vancouver");
            scheduledDate = nowVancouver.add(delayMinutes, 'minute');
            delay = delayMinutes * 60 * 1000;
        } else if (typeof delayTime === 'string') {
            const parsedDate = parseNaturalLanguageTime(delayTime, "America/Vancouver");

            if (!parsedDate) {
                throw new Error("Invalid time format. Could not parse natural language time.");
            }

            scheduledDate = dayjs(parsedDate).tz("America/Vancouver");
            delay = scheduledDate.diff(dayjs());

            if (delay < 0) {
                throw new Error("Schedule time is in the past");
            }
        } else {
            throw new Error("Invalid delay time format.");
        }

        const job = await callScheduleQueue.add("call-schedule", { phNo, fromNumber, name, metadata }, { delay, removeOnComplete: true });
        console.log(`Call scheduled successfully for ${scheduledDate.format()} (Vancouver time) with delay ${delay}ms`);
        console.log(`Job Id: ${job.id}`);

        return {
            message: "Call scheduled successfully",
            scheduledTime: scheduledDate.format(),
            delay,
            jobId: job.id
        };
    }
}
