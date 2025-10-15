import { Request, Response } from 'express';
import HttpStatusCodes from '../../constants/HttpStatusCodes';
import wsService from './ws.service';
import { WhatsAppWebhookPayload, SendMessagesDto, TextPayload, FilePayload } from './ws.dto';
import { RouteError } from '../../other/errorHandler';
import { addMessageToQueue, addImageToQueue, addFileToQueue } from '../../queues/messageQueue';

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
 * Helper para verificar si un payload es TextPayload
 */
function isTextPayload(payload: any): payload is TextPayload {
  return 'content' in payload && typeof payload.content === 'string';
}

/**
 * Helper para verificar si un payload es FilePayload
 */
function isFilePayload(payload: any): payload is FilePayload {
  return 'url' in payload && 'filename' in payload && 'mimetype' in payload;
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
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Missing required fields: chatId and session are required');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'messages must be a non-empty array');
    }

    const jobIds: string[] = [];
    console.log({
      encolando: messages,
    })
    // Procesar cada mensaje del array
    for (const message of messages) {
      const { type, payload } = message;
      console.log({
        type,
        payload,
      })

      // Validar que tenga tipo y payload
      if (!type || !payload) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Each message must have type and payload');
      }

      let jobId: string;
      switch (type) {
        case 'text': {
          if (!isTextPayload(payload)) {
            throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Text message must have content in payload');
          }

          jobId = await addMessageToQueue({
            chatId,
            text: payload.content,
            session,
          });
          break;
        }

        case 'image': {
          if (!isFilePayload(payload)) {
            throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Image message must have url, filename, and mimetype in payload');
          }

          jobId = await addImageToQueue({
            chatId,
            file: {
              url: payload.url,
              filename: payload.filename,
              mimetype: payload.mimetype,
            },
            reply_to: payload.reply_to || null,
            caption: payload.caption,
            session,
          });
          break;
        }

        case 'file': {
          if (!isFilePayload(payload)) {
            throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'File message must have url, filename, and mimetype in payload');
          }

          jobId = await addFileToQueue({
            chatId,
            file: {
              url: payload.url,
              filename: payload.filename,
              mimetype: payload.mimetype,
            },
            reply_to: payload.reply_to || null,
            caption: payload.caption,
            session,
          });
          break;
        }

        default:
          throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Unsupported message type: ${type}`);
      }

      jobIds.push(jobId);
    }

    // Responder inmediatamente con los IDs de todos los jobs
    res.status(HttpStatusCodes.ACCEPTED).json({
      success: true,
      jobIds,
      count: jobIds.length,
      message: `${jobIds.length} message(s) queued successfully`,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error queuing messages:', error);
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error while queuing messages');
  }
}
