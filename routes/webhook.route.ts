import express from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = express.Router();

router.post("/retell", WebhookController.handleRetellWebhook);

export default router;
