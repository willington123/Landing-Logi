// Inicio: what needs the team's attention now, and how the AI assistant is doing. Shared by the panel and the server.
import type { TagColor } from '@/lib/crm';

export interface HomeChat {
  id: string; // phone (WhatsApp) or m…/i… (Messenger / Instagram)
  name: string;
  preview: string; // last message
  since: string | null; // when it started waiting (handed over / last reply of the AI)
  lastInboundAt: string | null;
  waiting: boolean; // the customer wrote last
  note: string; // why the AI handed it over
  reason: 'handoff' | 'limit' | 'retake';
  tags: { name: string; color: TagColor }[];
  order: { number: string; status: string; product: string; total: number } | null;
  assignee: string | null;
  fromAd: boolean;
}

export interface HomeData {
  range: string;
  since: string;
  until: string;
  hasChats: boolean;
  bot: { enabled: boolean; name: string };
  help: { count: number; items: HomeChat[] };
  retake: { count: number; items: HomeChat[] };
  sales: { count: number; revenue: number };
  attending: { count: number; mine: boolean }; // mine = chats of the person signed in (false = the whole team)
  ai: { chats: number; solo: number; team: number; waiting: number };
}

// Minimum silence before a chat the AI answered shows up in "Retoma".
export const RETAKE_AFTER_MS = 2 * 3600_000;
// WhatsApp's free reply window.
export const WINDOW_MS = 24 * 3600_000;

export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '';
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h`;
  const d = Math.floor(m / 1440);
  return `${d} ${d === 1 ? 'día' : 'días'}`;
}

// "Buenos días / Buenas tardes / Buenas noches" in Colombia time.
export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
