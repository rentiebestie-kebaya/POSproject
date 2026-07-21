/**
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}
