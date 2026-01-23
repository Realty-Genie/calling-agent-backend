import { Queue } from "bullmq";
import { connection } from "./connection";

export const callScheduleQueue = new Queue("call-schedule-queue", {
  connection: connection
});

export default callScheduleQueue;
