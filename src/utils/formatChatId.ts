/**
 * Formats a phone number to WhatsApp chatId format
 * 
 * Input formats supported:
 * - 5491157439962 (already international without +)
 * - +541157439962 (international with +, Argentina without 9)
 * - 541157439962 (international without + and without 9)
 * - 5491157439962@c.us (already in WhatsApp format)
 * 
 * Output format: 5491157439962@c.us
 * 
 * Note: For Argentina (+54), mobile numbers require a "9" after the country code
 */
export function formatChatId(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid chatId: must be a non-empty string');
  }

  let chatId = input.trim();

  // If already has @c.us suffix, just clean the number part
  if (chatId.endsWith('@c.us')) {
    const numberPart = chatId.replace('@c.us', '');
    const cleanNumber = cleanPhoneNumber(numberPart);
    const normalizedNumber = normalizeArgentinaNumber(cleanNumber);
    return `${normalizedNumber}@c.us`;
  }

  // Clean the phone number (remove +, spaces, dashes, etc.)
  const cleanNumber = cleanPhoneNumber(chatId);
  const normalizedNumber = normalizeArgentinaNumber(cleanNumber);

  return `${normalizedNumber}@c.us`;
}

/**
 * Removes non-numeric characters from a phone number
 * Keeps only digits
 */
function cleanPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 0) {
    throw new Error('Invalid phone number: no digits found');
  }

  // Validate minimum length (at least country code + some digits)
  if (cleaned.length < 8) {
    throw new Error('Invalid phone number: too short');
  }

  return cleaned;
}

/**
 * Normalizes Argentina phone numbers by adding the "9" after country code if missing
 * Argentina mobile numbers in WhatsApp format: 549XXXXXXXXXX
 * 
 * Examples:
 * - 541157439962 → 5491157439962 (adds 9)
 * - 5491157439962 → 5491157439962 (already correct)
 * - 12025551234 → 12025551234 (not Argentina, unchanged)
 */
function normalizeArgentinaNumber(phone: string): string {
  // Check if it's an Argentina number (starts with 54)
  if (!phone.startsWith('54')) {
    return phone;
  }

  // Check if it already has the 9 after 54
  if (phone.startsWith('549')) {
    return phone;
  }

  // Add the 9 after the country code (54)
  // 541157439962 → 5491157439962
  return '549' + phone.substring(2);
}

export default formatChatId;

