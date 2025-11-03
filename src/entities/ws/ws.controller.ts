import { Request, Response } from 'express';
import HttpStatusCodes from '../../constants/HttpStatusCodes';
import wsService from './ws.service';
import { WhatsAppWebhookPayload, SendMessagesDto } from './ws.dto';
import { RouteError } from '../../other/errorHandler';
import { addBatchMessagesToQueue } from '../../queues/messageQueue';

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
  } catch (error: any) {
    console.error('Error processing webhook:', error.response?.data);
    console.error('Error processing webhook:', error);
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while processing webhook');
  }
}

/**
 * Send WhatsApp messages (text, images, files) through WAHA API (via queue)
 * Accepts an array of messages with different types
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const { chatId, messages, session }: SendMessagesDto = req.body;

    // Validate required fields
    if (!chatId || !session) {
      console.log('Missing required fields:', { chatId, session });
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Missing required fields: chatId and session are required');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('Invalid messages array:', messages);
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'messages must be a non-empty array');
    }

    console.log({
      encolandoBatch: messages.length,
      messages
    });

    // Encolar todos los mensajes como una sola tarea
    const jobId = await addBatchMessagesToQueue({
      chatId,
      messages,
      session
    });

    // Responder inmediatamente con el ID del job
    res.status(HttpStatusCodes.ACCEPTED).json({
      success: true,
      jobId,
      count: messages.length,
      message: `${messages.length} message(s) queued successfully in batch`,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error queuing messages:', error);
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while queuing messages');
  }
}
