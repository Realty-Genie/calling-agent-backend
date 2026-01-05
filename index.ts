import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import callRouter from "./routes/call.route";
import leadRouter from "./routes/lead.route";
import authRouter from "./routes/auth.route";
import adminRouter from "./routes/admin.route";
import webhookRouter from "./routes/webhook.route";


dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/webhook", webhookRouter);
app.use("/call", callRouter);
app.use("/leads", leadRouter);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📞 Retell Call API running on port ${PORT}`);
});

