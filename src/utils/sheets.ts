import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';

interface WebhookRow {
  numero_bot: string;
  numero_excepto?: string;
  numero_permitido?: string;
  webhook: string;
  comando?: string;
}

interface WebhookResult {
  webhook: string | null;
  shouldRespond: boolean;
}

class GoogleSheetsClient {
  private sheet: GoogleSpreadsheet;
  
  constructor(spreadsheetId: string) {
    this.sheet = new GoogleSpreadsheet(spreadsheetId, new JWT({
      email: process.env.GOOGLE_AUTH_CLIENT_EMAIL,
      key: process.env.GOOGLE_AUTH_PRIVATE_KEY,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    }));
  }

  /**
   * Checks if a phone number should be ignored or allowed
   * @param numeroExcepto - Comma-separated string of numbers to exclude
   * @param numeroPermitido - Comma-separated string of numbers to allow (if set, ONLY these are allowed)
   * @param userPhone - The phone number to check
   * @returns True if should respond, false otherwise
   */
  private shouldRespondToNumber(numeroExcepto: string | undefined, numeroPermitido: string | undefined, userPhone: string): boolean {
    // Check if number is in exception list (should NOT respond)
    if (numeroExcepto) {
      const exceptedNumbers = numeroExcepto.split(',').map(n => n.trim());
      if (exceptedNumbers.includes(userPhone)) {
        console.log(`🚫 Número ${userPhone} está en la lista de excepciones`);
        return false;
      }
    }

    // Check if there's a allowed list (if yes, ONLY respond to those)
    if (numeroPermitido) {
      const allowedNumbers = numeroPermitido.split(',').map(n => n.trim());
      const isAllowed = allowedNumbers.includes(userPhone);
      if (!isAllowed) {
        console.log(`🚫 Número ${userPhone} no está en la lista de permitidos`);
      }
      return isAllowed;
    }

    // No restrictions, respond
    return true;
  }

  /**
   * Gets the webhook URL for a given bot number and user phone
   * @param botNumber - The bot's phone number (sender)
   * @param userPhone - The user's phone number
   * @returns Object with webhook URL and shouldRespond flag
   */
  async getWebhook(botNumber: string, userPhone: string): Promise<WebhookResult> {
    const rows = (await this.getRows()).map((r) => r.toObject() as WebhookRow);
    const row = rows.find(row => row.numero_bot === botNumber);
    
    if (!row) {
      console.log(`❌ No se encontró configuración para el bot ${botNumber}`);
      return { webhook: null, shouldRespond: false };
    }

    const shouldRespond = this.shouldRespondToNumber(row.numero_excepto, row.numero_permitido, userPhone);
    
    return {
      webhook: shouldRespond ? row.webhook : null,
      shouldRespond
    };
  }

  /**
   * Gets the webhook URL for a given bot number, user phone and command
   * @param botNumber - The bot's phone number (sender)
   * @param userPhone - The user's phone number
   * @param command - The command to search for
   * @returns Object with webhook URL and shouldRespond flag
   */
  async getWebhookByCommand(botNumber: string, userPhone: string, command: string): Promise<WebhookResult> {
    const rows = (await this.getRows()).map((r) => r.toObject() as WebhookRow);
    const row = rows.find(row => row.numero_bot === botNumber && row.comando === command);
    
    if (!row) {
      console.log(`❌ No se encontró configuración para el bot ${botNumber} con comando ${command}`);
      return { webhook: null, shouldRespond: false };
    }

    const shouldRespond = this.shouldRespondToNumber(row.numero_excepto, row.numero_permitido, userPhone);
    
    return {
      webhook: shouldRespond ? row.webhook : null,
      shouldRespond
    };
  }

  /**
   * Checks if a bot number exists in the sheet
   * @param botNumber - The bot's phone number to check
   * @returns True if the number exists, false otherwise
   */
  async existsNumber(botNumber: string): Promise<boolean> {
    const rows = (await this.getRows()).map((r) => r.toObject() as WebhookRow);
    const exists = rows.some(row => row.numero_bot === botNumber);
    return exists;
  }

  private async getRows(): Promise<GoogleSpreadsheetRow[]> {
    await this.sheet.loadInfo();
    const worksheet = this.sheet.sheetsByIndex[0]; // Assumes first worksheet
    return await worksheet.getRows();
  }
}

const sheet = new GoogleSheetsClient(process.env.GOOGLE_SHEET_ID)

export default sheet