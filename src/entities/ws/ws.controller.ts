import { Request, Response, Router } from 'express';
import HttpStatusCodes from '../../constants/HttpStatusCodes';
import wsService from './ws.service';
import { WhatsAppWebhookPayload, SendMessageDto } from './ws.dto';
import { RouteError } from '../../other/errorHandler';

/**
 * Webhook endpoint to receive WhatsApp messages
 * Currently just logs the incoming messages
 */
export async function handleWebhook(req: Request, res: Response) {
  try {
    const payload: WhatsAppWebhookPayload = req.body;

    await wsService.processWebhook(payload);

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Error processing webhook:', error.response?.data);
    console.error('Error processing webhook:', error);
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while processing webhook');
  }
}

/**
 * Send a WhatsApp message through WAHA API
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const { chatId, text, session }: SendMessageDto = req.body;

    // Validate required fields
    if (!chatId || !text || !session) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Missing required fields: chatId, text, and session are required');
    }

    // Send the message through WAHA
    const result = await wsService.sendMessage({ chatId, text, session });

    if (result.success) {
      res.status(HttpStatusCodes.OK).json({
        success: true,
        messageId: result.messageId,
        message: 'Message sent successfully'
      });
    } else {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, result.error);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while sending message');
  }
}
