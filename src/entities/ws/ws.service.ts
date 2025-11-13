import axios from 'axios';
import { SendMessageDto, SendImageDto, SendFileDto, SendMessageResponseDto, WahaApiResponse, WhatsAppWebhookPayload } from './ws.dto';
import { wahaClient } from '../../other/wahaClient';
import sheet from '../../utils/sheets';
import { RouteError } from '../../other/errorHandler';
import HttpStatusCodes from '../../constants/HttpStatusCodes';
import { processWebhookMessage } from '../../utils/webhook';
import { waitRandom, wait, getRandomDelay } from '../../utils/wait';

/**
 * Calculate typing delay based on message length
 * Shorter messages: 2-5 seconds
 * Medium messages: 4-7 seconds  
 * Long messages: 5-10 seconds
 */
function calculateTypingDelay(textLength: number): number {
  if (textLength <= 30) {
    // Short messages: 2-5 seconds
    return getRandomDelay(2000, 5000);
  } else if (textLength <= 150) {
    // Medium messages: 4-7 seconds
    return getRandomDelay(4000, 7000);
  } else {
    // Long messages: 5-10 seconds
    return getRandomDelay(5000, 10000);
  }
}

/**
 * Process incoming WhatsApp webhook payload
 * Currently just logs the message for debugging
 */
async function processWebhook({payload}: WhatsAppWebhookPayload): Promise<void> {
  if (payload?.body && !payload.hasMedia) {
    const userPhone = payload?.from.split('@')[0]; // Número del usuario que envía
    const botNumber = payload?.to.split('@')[0]; // Número del bot que recibe
    
    const existsNumber = await sheet.existsNumber(botNumber)
    if(!existsNumber) {
      console.log(`🚫 Bot ${botNumber} no encontrado en la configuración`)
      return
    }
    
    const { messageToSend, webhook } = await processWebhookMessage(payload.body, userPhone, botNumber)
    
    // Si no hay webhook, significa que no se debe responder (por filtros de permitidos/exceptuados)
    if(!webhook) {
      console.log(`🚫 No se enviará mensaje para bot ${botNumber} y usuario ${userPhone}`)
      return
    }
    
    await axios.post(webhook, { 
      message: messageToSend, 
      userPhone: userPhone, 
      userName: payload._data.notifyName
    })
  }
}

/**
 * Send a message through WAHA API
 */
async function sendMessage(data: SendMessageDto): Promise<SendMessageResponseDto> {
  try {
    //veo el mensaje y espero unos segundos
    await sendSeen(data);
    await waitRandom(0, 2000);
    //inicio a escribir
    await startTyping(data);
    //espero un tiempo basado en la longitud del mensaje
    const typingDelay = calculateTypingDelay(data.text.length);
    await wait(typingDelay);
    //paro de escribir
    console.log('📤 Enviando mensaje a través de WAHA:', {
      chatId: data.chatId,
      session: data.session,
      textLength: data.text.length,
      reply_to: data.reply_to
    });

    //envio el mensaje
    const response = await wahaClient.post(
      `/api/sendText`,
      {
        chatId: data.chatId,
        session: data.session,
        text: data.text,
        reply_to: data.reply_to
      }
    );
    await stopTyping(data);

    const wahaResponseSuccess: boolean = response.status === 201;
    const wahaResponse: WahaApiResponse = response.data;

    if (wahaResponseSuccess) {
      return {
        success: true,
        messageId: wahaResponse.id
      };
    } else {
      console.error('❌ Error al enviar mensaje:', wahaResponse.message);
      return {
        success: false,
        error: wahaResponse.message || 'Error desconocido al enviar mensaje'
      };
    }
  } catch (error) {
    console.error('❌ Error en sendMessage:', error);
    
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || error.message;
      return {
        success: false,
        error: `Error de conexión con WAHA: ${errorMessage}`
      };
    }

    return {
      success: false,
      error: 'Error interno del servidor'
    };
  }
}

async function startTyping(data: {chatId: string, session: string}): Promise<void> {
  try {
    await wahaClient.post(
      `/api/startTyping`,
      {
        chatId: data.chatId,
        session: data.session
      }
    );
  } catch (error) {
    console.error('❌ Error en startTyping:', error);
    throw error;
  }
}

async function stopTyping(data: {chatId: string, session: string}): Promise<void> {
  try {
    await wahaClient.post(
      `/api/stopTyping`,
      {
        chatId: data.chatId,
        session: data.session
      }
    );
  } catch (error) {
    console.error('❌ Error en stopTyping:', error);
    throw error;
  }
}

async function sendSeen(data: {chatId: string, session: string}): Promise<void> {
  try {
    await wahaClient.post(
      `/api/sendSeen`,
      {
        chatId: data.chatId,
        session: data.session
      }
    );
  } catch (error) {
    console.error('❌ Error en sendSeen:', error);
    throw error;
  }
}

/**
 * Send an image through WAHA API
 */
async function sendImage(data: SendImageDto): Promise<SendMessageResponseDto> {
  try {
    // Ver el mensaje y esperar unos segundos
    await sendSeen(data);
    await waitRandom(0, 2000);

    console.log('📤 Enviando imagen a través de WAHA:', {
      chatId: data.chatId,
      session: data.session,
      filename: data.file.filename
    });

    // Enviar la imagen
    const response = await wahaClient.post(
      `/api/sendImage`,
      {
        chatId: data.chatId,
        session: data.session,
        file: {
          mimetype: data.file.mimetype,
          filename: data.file.filename,
          url: data.file.url,
        },
        caption: data.caption,
        reply_to: data.reply_to,
      }
    );

    const wahaResponseSuccess: boolean = response.status === 201;
    const wahaResponse: WahaApiResponse = response.data;

    if (wahaResponseSuccess) {
      return {
        success: true,
        messageId: wahaResponse.id
      };
    } else {
      console.error('❌ Error al enviar imagen:', wahaResponse.message);
      return {
        success: false,
        error: wahaResponse.message || 'Error desconocido al enviar imagen'
      };
    }
  } catch (error) {
    console.error('❌ Error en sendImage:', error);

    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || error.message;
      return {
        success: false,
        error: `Error de conexión con WAHA: ${errorMessage}`
      };
    }

    return {
      success: false,
      error: 'Error interno del servidor'
    };
  }
}

/**
 * Send a file through WAHA API
 */
async function sendFile(data: SendFileDto): Promise<SendMessageResponseDto> {
  try {
    // Ver el mensaje y esperar unos segundos
    await sendSeen(data);
    await waitRandom(0, 2000);

    console.log('📤 Enviando archivo a través de WAHA:', {
      chatId: data.chatId,
      session: data.session,
      filename: data.file.filename
    });

    // Enviar el archivo
    const response = await wahaClient.post(
      `/api/sendFile`,
      {
        chatId: data.chatId,
        session: data.session,
        file: {
          mimetype: data.file.mimetype,
          filename: data.file.filename,
          url: data.file.url,
        },
        caption: data.caption,
        reply_to: data.reply_to,
      }
    );

    const wahaResponseSuccess: boolean = response.status === 201;
    const wahaResponse: WahaApiResponse = response.data;

    if (wahaResponseSuccess) {
      return {
        success: true,
        messageId: wahaResponse.id
      };
    } else {
      console.error('❌ Error al enviar archivo:', wahaResponse.message);
      return {
        success: false,
        error: wahaResponse.message || 'Error desconocido al enviar archivo'
      };
    }
  } catch (error) {
    console.error('❌ Error en sendFile:', error);

    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || error.message;
      return {
        success: false,
        error: `Error de conexión con WAHA: ${errorMessage}`
      };
    }

    return {
      success: false,
      error: 'Error interno del servidor'
    };
  }
}

export default {
  processWebhook,
  sendMessage,
  sendImage,
  sendFile,
  startTyping,
  stopTyping,
  sendSeen
};


