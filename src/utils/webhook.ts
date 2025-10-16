import sheet from "./sheets";

export const processWebhookMessage = async (message: string, userPhone: string, botNumber: string) => {
  let messageToSend = message;
  let webhook = null;
  let response = null;
  let shouldRespond = false;
  
  // Check if message is a command (starts with "/")
  if (message.startsWith('/')) {
    // Extract command and rest of message
    const parts = message.split(' ');
    const command = parts[0]; // e.g., "/generar-respuesta"
    messageToSend = parts.slice(1).join(' '); // Rest of the message without the command

    console.log(`Command detected: ${command}, Message: ${messageToSend}`)

    // Get webhook for this bot number, user phone and command
    const result = await sheet.getWebhookByCommand(botNumber, userPhone, command)
    webhook = result.webhook;
    shouldRespond = result.shouldRespond;
    
    console.log({ webhook, shouldRespond })

    if (!shouldRespond) {
      console.log(`No se debe responder al número ${userPhone} para el bot ${botNumber} con comando ${command}`)
      return { messageToSend, webhook: null, response: null }
    }

    if (!webhook) {
      console.log(`No webhook found for bot ${botNumber}, user ${userPhone} and command ${command}`)
      response = `No se encontró configuración para el comando ${command}`
    }
  } else {
    // Get the default webhook for this bot number and user phone
    const result = await sheet.getWebhook(botNumber, userPhone)
    webhook = result.webhook;
    shouldRespond = result.shouldRespond;
    
    console.log({ webhook, shouldRespond })
    
    if (!shouldRespond) {
      console.log(`No se debe responder al número ${userPhone} para el bot ${botNumber}`)
      return { messageToSend, webhook: null, response: null }
    }
    
    if (!webhook) {
      console.log(`No webhook found for bot ${botNumber} and user ${userPhone}`)
      response = 'Falta webhook para el numero de telefono'
    }
  }
  
  return {
    messageToSend,
    webhook,
    response,
  }
}