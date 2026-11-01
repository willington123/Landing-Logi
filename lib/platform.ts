// Who operates the Konnexa platform (shown in the terms, the privacy policy and the sales page footer).
// Meta and Wompi compare it with the verified business: keep it identical to the legal data there.
export interface PlatformOperator {
  name: string | null; // legal name, e.g. "Fundación Trébol"
  taxId: string | null; // e.g. "NIT 900126576-7"
  address: string | null;
  email: string | null;
  whatsapp: string | null; // digits
}

const v = (k: string) => (process.env[k] || '').trim() || null;

export function platformOperator(): PlatformOperator {
  return {
    name: v('PLATFORM_COMPANY_NAME'),
    taxId: v('PLATFORM_COMPANY_ID'),
    address: v('PLATFORM_COMPANY_ADDRESS'),
    email: v('PLATFORM_SUPPORT_EMAIL'),
    whatsapp: (v('PLATFORM_WHATSAPP') || '').replace(/\D/g, '') || null,
  };
}

// "Fundación Trébol, NIT 900126576-7, KR 45 # 6 B – 102, Cali" (only the parts that are set).
export function operatorLine(o = platformOperator()): string | null {
  const parts = [o.name, o.taxId, o.address].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
