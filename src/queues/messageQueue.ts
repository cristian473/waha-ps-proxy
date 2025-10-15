import { Queue, QueueEvents } from 'bullmq';
import { SendMessageDto, SendImageDto, SendFileDto, MessageType } from '../entities/ws/ws.dto';

// Configuración de conexión a Redis
export const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Interface para el job data base
export interface BaseMessageJobData {
  chatId: string;
  session: string;
  queueKey: string; // session - para rastrear concurrencia
  messageType: MessageType; // tipo de mensaje
}

// Interface para job de texto
export interface TextMessageJobData extends BaseMessageJobData {
  messageType: 'text';
  text: string;
  reply_to?: string;
}

// Interface para job de archivo/imagen
export interface FileMessageJobData extends BaseMessageJobData {
  messageType: 'file' | 'image';
  file: {
    mimetype: string;
    filename: string;
    url: string;
  };
  reply_to?: string | null;
  caption?: string;
}

// Union type para todos los tipos de jobs
export type MessageJobData = TextMessageJobData | FileMessageJobData;

// Crear la queue de mensajes con BullMQ
export const messageQueue = new Queue<MessageJobData>('whatsapp-messages', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Reintentar hasta 3 veces en caso de fallo
    backoff: {
      type: 'exponential',
      delay: 2000, // Esperar 2 segundos entre reintentos
    },
    removeOnComplete: {
      age: 3600, // Mantener jobs completados por 1 hora
      count: 100, // Mantener máximo 100 jobs completados
    },
    removeOnFail: {
      age: 86400, // Mantener jobs fallidos por 24 horas
    },
  },
});

// QueueEvents para escuchar eventos de la queue
const queueEvents = new QueueEvents('whatsapp-messages', {
  connection: redisConnection,
});

// Mapa para rastrear trabajos activos por session
const activeJobs = new Map<string, number>();

/**
 * Verifica si se puede procesar un nuevo mensaje para una session
 */
export function canProcessMessage(session: string): boolean {
  const currentCount = activeJobs.get(session) || 0;
  return currentCount < 2; // Máximo 2 conversaciones simultáneas por session
}

/**
 * Incrementa el contador de trabajos activos para una session
 */
export function incrementActiveJobs(session: string): void {
  const currentCount = activeJobs.get(session) || 0;
  activeJobs.set(session, currentCount + 1);
  console.log(`📊 Session ${session}: ${currentCount + 1} jobs activos`);
}

/**
 * Decrementa el contador de trabajos activos para una session
 */
export function decrementActiveJobs(session: string): void {
  const currentCount = activeJobs.get(session) || 0;
  if (currentCount > 0) {
    activeJobs.set(session, currentCount - 1);
    console.log(`📊 Session ${session}: ${currentCount - 1} jobs activos`);
  }
}

/**
 * Obtiene el número de trabajos activos para una session
 */
export function getActiveJobsCount(session: string): number {
  return activeJobs.get(session) || 0;
}

/**
 * Genera un delay aleatorio entre 2 y 10 segundos (en milisegundos)
 */
export function getRandomDelay(minDelay = 2000, maxDelay = 10000): number {
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

/**
 * Agrega un mensaje de texto a la queue con delay aleatorio
 */
export async function addMessageToQueue(data: SendMessageDto): Promise<string> {
  const queueKey = `${data.session}`;

  const jobData: TextMessageJobData = {
    chatId: data.chatId,
    session: data.session,
    queueKey,
    messageType: 'text',
    text: data.text,
  };

  const job = await messageQueue.add(
    'send-message',
    jobData,
    {
      jobId: `${queueKey}-${data.chatId}-text-${Date.now()}`, // ID único para el job
    }
  );

  console.log(`📥 Mensaje de texto encolado con ID: ${job.id} para session ${queueKey}`);
  return job.id || '';
}

/**
 * Agrega una imagen a la queue con delay aleatorio
 */
export async function addImageToQueue(data: SendImageDto): Promise<string> {
  const queueKey = `${data.session}`;

  const jobData: FileMessageJobData = {
    chatId: data.chatId,
    session: data.session,
    queueKey,
    messageType: 'image',
    file: data.file,
    reply_to: data.reply_to || undefined,
    caption: data.caption,
  };

  const job = await messageQueue.add(
    'send-image',
    jobData,
    {
      jobId: `${queueKey}-${data.chatId}-image-${Date.now()}`, // ID único para el job
      
    }
  );

  console.log(`📥 Imagen encolada con ID: ${job.id} para session ${queueKey}`);
  return job.id || '';
}

/**
 * Agrega un archivo a la queue con delay aleatorio
 */
export async function addFileToQueue(data: SendFileDto): Promise<string> {
  const queueKey = `${data.session}`;

  const jobData: FileMessageJobData = {
    chatId: data.chatId,
    session: data.session,
    queueKey,
    messageType: 'file',
    file: data.file,
    reply_to: data.reply_to || undefined,
    caption: data.caption,
  };

  const job = await messageQueue.add(
    'send-file',
    jobData,
    {
      jobId: `${queueKey}-${data.chatId}-file-${Date.now()}`, // ID único para el job
    }
  );

  console.log(`📥 Archivo encolado con ID: ${job.id} para session ${queueKey}`);
  return job.id || '';
}

// Eventos de la queue para logging
queueEvents.on('waiting', ({ jobId }) => {
  console.log(`⏳ Job ${jobId} esperando para ser procesado`);
});

queueEvents.on('active', ({ jobId }) => {
  console.log(`🔄 Job ${jobId} está siendo procesado`);
});

queueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Job ${jobId} completado exitosamente`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} falló:`, failedReason);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`📈 Job ${jobId} progreso:`, data);
});

export { queueEvents };
export default messageQueue;
