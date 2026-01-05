import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CallController } from '../controllers/call.controller';

const router = express.Router();

router.use(authMiddleware);

router.post("/lead", CallController.initiateCall);
router.get("/:callId", CallController.getCallDetails);
router.post("/batch", CallController.createBatchCall);

export default router;