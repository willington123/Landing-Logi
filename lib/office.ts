// Oficina: the team and the AI assistant working, as a live isometric office. Shared by the panel and the server.

export interface OfficePerson {
  id: string; // team person id, or u:<userId> for someone signed in who isn't on the team list
  name: string;
  online: boolean; // has the panel open (seen in the last ~90 s)
  available: boolean; // gets new chats from the automatic assignment
  typing: boolean;
  onChat: string | null; // customer whose chat is open on their screen
  assigned: number; // chats assigned with activity in the last 24 h
}

export interface OfficeWaiting {
  id: string;
  name: string;
  since: string | null;
  note: string;
}

export interface OfficeData {
  store: { id: string; name: string };
  bot: { enabled: boolean; name: string };
  ai: { active: number; names: string[] }; // chats the AI is answering right now (customer wrote in the last 30 min)
  people: OfficePerson[];
  waiting: OfficeWaiting[]; // handed to a person, nobody has taken them
  updatedAt: string;
}

export const ONLINE_MS = 90_000;
export const AI_ACTIVE_MS = 30 * 60_000;
