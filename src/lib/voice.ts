import { useStorm } from "./store";

let mediaCtx: AudioContext | null = null;
let speakTimer = 0;
let unlocked = false;

function armMediaVolume() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      if (!mediaCtx) mediaCtx = new AC();
      if (mediaCtx.state === "suspended") void mediaCtx.resume();
      if (!unlocked) {
        const buf = mediaCtx.createBuffer(1, 1, 22050);
        const src = mediaCtx.createBufferSource();
        src.buffer = buf;
        src.connect(mediaCtx.destination);
        src.start(0);
        unlocked = true;
      }
    }
  } catch {
    /* ignore */
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() || [];
  const us = voices.filter((v) => /en-US/i.test(v.lang || ""));
  return (
    us.find((v) => /samantha|nicky|aaron|enhanced|premium|siri|compact/i.test(v.name || "")) ||
    us[0] ||
    voices[0] ||
    null
  );
}

function fireUtterance(text: string, volume: number) {
  const synth = window.speechSynthesis;
  try {
    synth.resume();
  } catch {
    /* ignore */
  }
  const u = new SpeechSynthesisUtterance(String(text));
  u.volume = Math.max(0, Math.min(1, volume));
  u.rate = 1;
  u.pitch = 1;
  u.lang = "en-US";
  const v = pickVoice();
  if (v) u.voice = v;
  synth.speak(u);
}

export function speak(text: string, force = false) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  const prefs = useStorm.getState().prefs;
  if (!force && !prefs.voice) return;
  const volume = prefs.voiceVolume ?? 0.85;
  if (volume <= 0.01) return;
  try {
    armMediaVolume();
    const synth = window.speechSynthesis;
    if (speakTimer) {
      window.clearTimeout(speakTimer);
      speakTimer = 0;
    }
    if (synth.speaking || synth.pending) {
      synth.cancel();
      speakTimer = window.setTimeout(() => {
        speakTimer = 0;
        fireUtterance(text, volume);
      }, 60);
    } else {
      fireUtterance(text, volume);
    }
  } catch {
    /* ignore */
  }
}

export function cancelVoice() {
  if (speakTimer) {
    window.clearTimeout(speakTimer);
    speakTimer = 0;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
