import express from 'express';
const router = express.Router();
import { ScheduleCallController } from '../controllers/scheduleCall.controller';

router.post("/", ScheduleCallController.scheduleCall);

export default router;