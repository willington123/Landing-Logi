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
  followUpAt?: string | null; // the AI's automatic follow-up really went out (after the last message of the customer)
  org?: string; // store, when several are shown together (set in the panel)
  store?: string;
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

// Minimum silence before a chat the AI answered shows up in "Por retomar".
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

// Several stores in one Inicio: lists merged (newest first), numbers added up.
export function mergeHome(parts: { org: string; store: string; data: HomeData }[], max = 50): HomeData | null {
  if (!parts.length) return null;
  const tag = (p: (typeof parts)[number], items: HomeChat[]) => items.map((c) => ({ ...c, org: p.org, store: p.store }));
  const byNewest = (a: HomeChat, b: HomeChat) => String(b.since || '').localeCompare(String(a.since || ''));
  const sum = (f: (d: HomeData) => number) => parts.reduce((n, p) => n + f(p.data), 0);
  const first = parts[0].data;
  return {
    range: first.range,
    since: first.since,
    until: first.until,
    hasChats: parts.some((p) => p.data.hasChats),
    bot: { enabled: parts.some((p) => p.data.bot.enabled), name: parts.find((p) => p.data.bot.enabled)?.data.bot.name || first.bot.name },
    help: { count: sum((d) => d.help.count), items: parts.flatMap((p) => tag(p, p.data.help.items)).sort(byNewest).slice(0, max) },
    retake: { count: sum((d) => d.retake.count), items: parts.flatMap((p) => tag(p, p.data.retake.items)).sort(byNewest).slice(0, max) },
    sales: { count: sum((d) => d.sales.count), revenue: sum((d) => d.sales.revenue) },
    attending: { count: sum((d) => d.attending.count), mine: parts.some((p) => p.data.attending.mine) },
    ai: { chats: sum((d) => d.ai.chats), solo: sum((d) => d.ai.solo), team: sum((d) => d.ai.team), waiting: sum((d) => d.ai.waiting) },
  };
}
