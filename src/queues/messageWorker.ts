import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  MessageJobData,
  TextMessageJobData,
  FileMessageJobData,
  BatchMessageJobData,
  canProcessMessage,
  incrementActiveJobs,
  decrementActiveJobs,
  redisConnection,
  messageQueue
} from './messageQueue';
import wsService from '../entities/ws/ws.service';
import { TextPayload, FilePayload } from '../entities/ws/ws.dto';

// 🔐 Conexión a Redis para locks
const redis = new IORedis(redisConnection);

// Tiempo máximo del lock (en segundos)
const LOCK_TTL = 30;

/**
 * Intenta adquirir un lock para un chat específico.
 * Devuelve true si se obtuvo el lock, false si ya estaba bloqueado.
 */
async function acquireChatLock(session: string, chatId: string): Promise<boolean> {
  const lockKey = `lock:${session}:${chatId}`;
  //@ts-ignore
  const result = await redis.set(lockKey, '1', 'NX', 'EX', LOCK_TTL);
  return result === 'OK';
}

/**
 * Libera el lock del chat.
 */
async function releaseChatLock(session: string, chatId: string): Promise<void> {
  const lockKey = `lock:${session}:${chatId}`;
  await redis.del(lockKey);
}

/**
 * Espera hasta que haya espacio disponible para procesar el mensaje
 */
async function waitForAvailableSlot(session: string, queueKey: string): Promise<void> {
  let attempts = 0;
  const maxAttempts = 60; // Máximo 60 intentos (5 minutos)

  while (!canProcessMessage(session)) {
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('Timeout waiting for available slot');
    }

    console.log(`⏸️  Límite de concurrencia alcanzado para session ${queueKey}, esperando... (intento ${attempts}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

/**
 * Procesa un job de mensaje de la queue
 */
async function processMessageJob(job: Job<MessageJobData>) {
  const { chatId, session, queueKey, messageType } = job.data;

  job.log(`🚀 Iniciando procesamiento de ${messageType} para session ${queueKey}`);
  job.log(`   Job ID: ${job.id}`);
  job.log(`   Chat ID: ${chatId}`);

  // Si es un batch, procesarlo de manera especial
  if (messageType === 'batch') {
    return await processBatchMessages(job as Job<BatchMessageJobData>);
  }

  // Esperar hasta que haya espacio disponible (no más de 2 concurrentes por session)
  await waitForAvailableSlot(session, queueKey);

  // 🔐 Intentar obtener lock para este chat
  const gotLock = await acquireChatLock(session, chatId);
  if (!gotLock) {
    // Ya hay un mensaje de este chat en proceso → reencolar con delay
    const delay = 2000
    console.log(`🔁 Chat ${chatId} bloqueado, reencolando job ${job.id} con delay ${delay}ms`);
    await messageQueue.add(job.name, job.data, { delay });
    return;
  }

  // Incrementar contador de jobs activos por session
  incrementActiveJobs(session);

  try {
    await job.updateProgress(25);

    let result: Awaited<ReturnType<typeof wsService.sendMessage>>;

    switch (messageType) {
      case 'text': {
        const textData = job.data as TextMessageJobData;
        job.log(`   Texto: ${textData.text.slice(0, 50)}`);
        result = await wsService.sendMessage({
          chatId,
          session,
          text: textData.text,
        });
        break;
      }
      case 'image': {
        const imageData = job.data as FileMessageJobData;
        job.log(`   Imagen: ${imageData.file.filename}`);
        result = await wsService.sendImage({
          chatId,
          session,
          file: imageData.file,
          caption: imageData.caption,
          reply_to: imageData.reply_to || undefined,
        });
        break;
      }
      case 'file': {
        const fileData = job.data as FileMessageJobData;
        job.log(`   Archivo: ${fileData.file.filename}`);
        result = await wsService.sendFile({
          chatId,
          session,
          file: fileData.file,
          caption: fileData.caption,
          reply_to: fileData.reply_to || undefined,
        });
        break;
      }
      default:
        throw new Error(`Tipo de mensaje no soportado: ${messageType}`);
    }

    await job.updateProgress(75);

    if (!result.success) {
      throw new Error(result.error || 'Error desconocido al enviar mensaje');
    }

    job.log(`✅ ${messageType} enviado exitosamente para ${queueKey}, Message ID: ${result.messageId}`);
    await job.updateProgress(100);

    return result;
  } catch (error: any) {
    job.log(`❌ Error al procesar ${messageType} para ${queueKey}: ${error.message}`);
    throw error;
  } finally {
    // Siempre liberar lock y decrementar contador
    await releaseChatLock(session, chatId);
    decrementActiveJobs(session);
  }
}

/**
 * Procesa un batch de mensajes secuencialmente
 */
async function processBatchMessages(job: Job<BatchMessageJobData>) {
  const { chatId, session, queueKey, messages } = job.data;

  job.log(`📦 Procesando batch de ${messages.length} mensajes para session ${queueKey}`);

  // Esperar hasta que haya espacio disponible
  await waitForAvailableSlot(session, queueKey);

  // 🔐 Obtener lock para este chat
  const gotLock = await acquireChatLock(session, chatId);
  if (!gotLock) {
    const delay = 2000;
    console.log(`🔁 Chat ${chatId} bloqueado, reencolando batch ${job.id} con delay ${delay}ms`);
    await messageQueue.add(job.name, job.data, { delay });
    return;
  }

  // Incrementar contador de jobs activos
  incrementActiveJobs(session);

  try {
    const results = [];
    const totalMessages = messages.length;

    // Procesar cada mensaje del batch secuencialmente
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const progress = Math.floor(((i + 1) / totalMessages) * 100);

      job.log(`📨 [${i + 1}/${totalMessages}] Procesando mensaje tipo ${message.type}`);

      let result: Awaited<ReturnType<typeof wsService.sendMessage>>;

      switch (message.type) {
        case 'text': {
          const payload = message.payload as TextPayload;
          job.log(`   Texto: ${payload.content.slice(0, 50)}`);
          result = await wsService.sendMessage({
            chatId,
            session,
            text: payload.content,
          });
          break;
        }
        case 'image': {
          const payload = message.payload as FilePayload;
          job.log(`   Imagen: ${payload.filename}`);
          result = await wsService.sendImage({
            chatId,
            session,
            file: {
              url: payload.url,
              filename: payload.filename,
              mimetype: payload.mimetype,
            },
            caption: payload.caption,
            reply_to: payload.reply_to,
          });
          break;
        }
        case 'file': {
          const payload = message.payload as FilePayload;
          job.log(`   Archivo: ${payload.filename}`);
          result = await wsService.sendFile({
            chatId,
            session,
            file: {
              url: payload.url,
              filename: payload.filename,
              mimetype: payload.mimetype,
            },
            caption: payload.caption,
            reply_to: payload.reply_to,
          });
          break;
        }
        default:
          throw new Error(`Tipo de mensaje no soportado: ${message.type}`);
      }

      if (!result.success) {
        throw new Error(result.error || `Error al enviar mensaje ${i + 1}`);
      }

      results.push(result);
      await job.updateProgress(progress);

      job.log(`✅ [${i + 1}/${totalMessages}] Mensaje enviado exitosamente, ID: ${result.messageId}`);
    }

    job.log(`🎉 Batch completado: ${results.length}/${totalMessages} mensajes enviados`);

    return {
      success: true,
      totalMessages,
      sentMessages: results.length,
      results,
    };
  } catch (error: any) {
    job.log(`❌ Error al procesar batch para ${queueKey}: ${error.message}`);
    throw error;
  } finally {
    await releaseChatLock(session, chatId);
    decrementActiveJobs(session);
  }
}

// Worker global
let worker: Worker<MessageJobData> | null = null;

export function startMessageWorker() {
  console.log('🔧 Iniciando worker de mensajes de WhatsApp con BullMQ...');

  worker = new Worker<MessageJobData>(
    'whatsapp-messages',
    async job => await processMessageJob(job),
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => console.log(`🎉 Worker completó el job ${job.id}`));
  worker.on('failed', (job, err) => console.error(`💥 Worker falló el job ${job?.id}:`, err.message));
  worker.on('error', (err) => console.error('❌ Error en el worker:', err));
  worker.on('ready', () => console.log('✅ Worker de mensajes listo'));

  console.log('✅ Worker de mensajes iniciado correctamente');
}

export async function stopMessageWorker() {
  if (worker) {
    console.log('🛑 Deteniendo worker de mensajes...');
    await worker.close();
    console.log('✅ Worker detenido');
  }
}

export { worker };
export default { startMessageWorker, stopMessageWorker };
