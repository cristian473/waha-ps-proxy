import { Router } from 'express';
import * as controller from './ws.controller';

const router = Router();

// Webhook endpoint - no authentication required (WAHA will call this directly)
router.post('/webhook', controller.handleWebhook);

// Send messages endpoint - requires token authentication
// Accepts an array of messages with different types (text, image, file)
router.post('/send-message', controller.sendMessage);

// Control action endpoints - requires token authentication
// Send seen indicator (mark message as read)
router.post('/send-seen', controller.sendSeen);

// Start typing indicator
router.post('/start-typing', controller.startTyping);

// Stop typing indicator
router.post('/stop-typing', controller.stopTyping);

export default router;


