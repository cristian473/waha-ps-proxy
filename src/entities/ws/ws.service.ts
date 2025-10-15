import axios from 'axios';
import { SendMessageDto, SendMessageResponseDto, WahaApiResponse, WhatsAppWebhookPayload } from './ws.dto';
import { wahaClient } from '../../other/wahaClient';
import sheet from '../../utils/sheets';
import { RouteError } from '../../other/errorHandler';
import HttpStatusCodes from '../../constants/HttpStatusCodes';
import { processWebhookMessage } from '../../utils/webhook';

/**
 * Process incoming WhatsApp webhook payload
 * Currently just logs the message for debugging
 */
async function processWebhook({payload}: WhatsAppWebhookPayload): Promise<void> {
  console.log({payload})
  if (payload?.body && !payload.hasMedia) {
    const number = payload?.from.split('@')[0];
    console.log({number})
    const existsNumber = await sheet.existsNumber(number)
    if(!existsNumber) {
      return
    }
    const { messageToSend, webhook } = await processWebhookMessage(payload.body, number)
    if(!webhook) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Webhook not found')
    }
    await axios.post(webhook, { 
      message: messageToSend, 
      userPhone: number, 
      userName: payload._data.notifyName
    })
  }
}

/**
 * Send a message through WAHA API
 */
async function sendMessage(data: SendMessageDto): Promise<SendMessageResponseDto> {
  try {
    console.log('📤 Enviando mensaje a través de WAHA:', {
      chatId: data.chatId,
      session: data.session,
      textLength: data.text.length
    });

    const response = await wahaClient.post(
      `/api/sendText`,
      {
        chatId: data.chatId,
        session: data.session,
        text: data.text
      }
    );

    const wahaResponseSuccess: boolean = response.status === 201;
    const wahaResponse: WahaApiResponse = response.data;

    if (wahaResponseSuccess) {
      console.log('✅ Mensaje enviado exitosamente:', wahaResponse);
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

export default {
  processWebhook,
  sendMessage,
};


