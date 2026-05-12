import { Message, PubSub } from "@google-cloud/pubsub";
import { CloudTasksClient } from "@google-cloud/tasks";
const client = new CloudTasksClient({});
// Creates a client; cache this for further use
const pubSubClient = new PubSub({
  projectId: "realtygenie",
});

export async function publishMessage(topicNameOrId: string, data: string) {
  // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
  const dataBuffer = Buffer.from(data);

  // Cache topic objects (publishers) and reuse them.
  const topic = pubSubClient.topic(topicNameOrId);
  try {
    const messageId = await topic.publishMessage({ data: dataBuffer });
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(
      `Received error while publishing: ${(error as Error).message}`,
    );
    process.exitCode = 1;
  }
}