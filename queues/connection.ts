import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
/* export const connection = new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null
}); */
if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not defined");
}
const redisUrl = process.env.REDIS_URL;
export const connection = new IORedis(redisUrl!, {
  maxRetriesPerRequest: null
})
console.log("REDIS CONNECTED");

