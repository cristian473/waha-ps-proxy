import { Request, Response } from 'express';
import HttpStatusCodes from '../../constants/HttpStatusCodes';
import wsService from './ws.service';
import { WhatsAppWebhookPayload, SendMessagesDto, ControlActionDto } from './ws.dto';
import { RouteError } from '../../other/errorHandler';
import { addBatchMessagesToQueue } from '../../queues/messageQueue';
import { formatChatId } from '../../utils/formatChatId';

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

    // Format chatId to WhatsApp format
    const formattedChatId = formatChatId(chatId);

    const jobId = await addBatchMessagesToQueue({
      chatId: formattedChatId,
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

/**
 * Send seen indicator (mark message as read)
 * Requires session and chatId (phone number)
 */
export async function sendSeen(req: Request, res: Response) {
  try {
    const { session, chatId }: ControlActionDto = req.body;

    // Validate required fields
    if (!session || !chatId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Missing required fields: session and chatId are required');
    }

    // Format chatId to WhatsApp format
    const formattedChatId = formatChatId(chatId);

    await wsService.sendSeen({ session, chatId: formattedChatId });

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Seen indicator sent successfully'
    });
  } catch (error: any) {
    console.error('Error sending seen:', error);
    if (error instanceof RouteError) {
      throw error;
    }
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while sending seen indicator');
  }
}

/**
 * Start typing indicator
 * Requires session and chatId (phone number)
 */
export async function startTyping(req: Request, res: Response) {
  try {
    const { session, chatId }: ControlActionDto = req.body;

    // Validate required fields
    if (!session || !chatId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Missing required fields: session and chatId are required');
    }

    // Format chatId to WhatsApp format
    const formattedChatId = formatChatId(chatId);

    await wsService.startTyping({ session, chatId: formattedChatId });

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Typing indicator started successfully'
    });
  } catch (error: any) {
    console.error('Error starting typing:', error);
    if (error instanceof RouteError) {
      throw error;
    }
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while starting typing indicator');
  }
}

/**
 * Stop typing indicator
 * Requires session and chatId (phone number)
 */
export async function stopTyping(req: Request, res: Response) {
  try {
    const { session, chatId }: ControlActionDto = req.body;

    // Validate required fields
    if (!session || !chatId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Missing required fields: session and chatId are required');
    }

    // Format chatId to WhatsApp format
    const formattedChatId = formatChatId(chatId);

    await wsService.stopTyping({ session, chatId: formattedChatId });

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Typing indicator stopped successfully'
    });
  } catch (error: any) {
    console.error('Error stopping typing:', error);
    if (error instanceof RouteError) {
      throw error;
    }
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while stopping typing indicator');
  }
}
