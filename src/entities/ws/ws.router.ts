import { Router } from 'express';
import * as controller from './ws.controller';

const router = Router();

// Webhook endpoint - no authentication required (WAHA will call this directly)
router.post('/webhook', controller.handleWebhook);

// Send message endpoint - requires token authentication
router.post('/send-message', controller.sendMessage);

export default router;


