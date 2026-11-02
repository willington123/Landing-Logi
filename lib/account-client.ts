'use client';

// The signed-in account (one request per page load, shared by the menu and the plan banner).
export interface AccountInfo {
  user: { id: string; email: string; name: string | null } | null;
  org: { id: string; name: string; role: string } | null;
  orgs: { id: string; name: string; role: string }[];
  platformAdmin?: boolean;
  businessType?: 'store' | 'appointments';
  plan?: {
    id: string;
    name: string;
    status: string;
    effective: string;
    daysLeft: number | null;
    panelLocked: boolean;
    landingsOff: boolean;
    accessEndsAt: string | null;
  } | null;
}

let pending: Promise<{ status: number; data: AccountInfo | null }> | null = null;

export function fetchAccount(fresh = false) {
  if (!pending || fresh) {
    pending = fetch('/api/account', { cache: 'no-store' })
      .then(async (r) => ({ status: r.status, data: r.ok ? ((await r.json()) as AccountInfo) : null }))
      .catch(() => ({ status: 0, data: null }));
  }
  return pending;
}
