'use client';

// New WhatsApp message alert: a short two-tone sound (no audio file needed). On by default.
const KEY = 'lp_msg_sound';
export const SOUND_EVENT = 'lp:sound-changed';
export const UNREAD_REFRESH_EVENT = 'lp:unread-refresh'; // a chat was read: update the menu badge now

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // private mode: the setting just isn't remembered
  }
  window.dispatchEvent(new Event(SOUND_EVENT));
}

let ctx: AudioContext | null = null;
export function playMessageSound() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // browsers may block sound until the page is clicked once
  }
}
