import { CloudTasksClient } from "@google-cloud/tasks";
import { protos } from "@google-cloud/tasks";
const client = new CloudTasksClient({});
export type ScheduleType = "contact-lead" | "call-schedule";
type JobData = {
  phNo: string;
  fromNumber: string;
  name: string;
  metadata:
    | {
        leadId: string;
        userId: string;
        isBatchCallRecord: boolean;
      }
    | {};
};

export async function createJob(
  scheduleType: ScheduleType,
  jobData: JobData,
  delayInfo: number,
) {
  const project = "realtygenie";
  const location = process.env.LOCATION || "northamerica-northeast1";
  const queue = process.env.QUEUE_NAME || "callgenie-queue-1";
  const parent = client.queuePath(project, location, queue);

  const payload = JSON.stringify({
    scheduleType: scheduleType,
    metadata: JSON.stringify(jobData.metadata),
    fromNumber: jobData.fromNumber,
    name: jobData.name,
    phNo: jobData.phNo,
  });

  const delaySeconds = Math.floor(delayInfo / 1000);

  const task: protos.google.cloud.tasks.v2.ITask = {
    httpRequest: {
      httpMethod: "POST",
      url: process.env.API_URL + "/call/publish",
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(payload).toString("base64"),
    },
    scheduleTime: {
      seconds: Math.floor(Date.now() / 1000) + delaySeconds,
    },
  };
  try {
    const response = await client.createTask({
      parent,
      task,
    });
    console.log("Task created:", response);
  } catch (error) {
    console.error("Error creating task:", error);
  }
}
