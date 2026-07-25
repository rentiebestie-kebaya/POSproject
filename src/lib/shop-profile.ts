export interface ShopProfileFields {
  name: string;
  location: string;
  whatsapp: string;
}

export class ShopProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopProfileValidationError";
  }
}

export function text(input: Record<string, unknown>, key: string): string {
  return typeof input[key] === "string" ? input[key].trim() : "";
}

export function validateShopName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) throw new ShopProfileValidationError("Store name is required.");
  return trimmed;
}

export function validateShopLocation(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) throw new ShopProfileValidationError("Store location is required.");
  return trimmed;
}

export function validateShopWhatsapp(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 6) throw new ShopProfileValidationError("WhatsApp number is required.");
  return trimmed;
}

export function parseShopProfileFields(
  input: Record<string, unknown>,
  keys: { name: string; location: string; whatsapp: string } = {
    name: "name",
    location: "location",
    whatsapp: "whatsapp",
  },
): ShopProfileFields {
  return {
    name: validateShopName(text(input, keys.name)),
    location: validateShopLocation(text(input, keys.location)),
    whatsapp: validateShopWhatsapp(text(input, keys.whatsapp)),
  };
}

export function shopProfileIsValid(input: ShopProfileFields): boolean {
  return (
    input.name.trim().length > 1 &&
    input.location.trim().length > 1 &&
    input.whatsapp.trim().length > 5
  );
}
