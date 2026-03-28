import { useEffect, useRef, useState, useCallback } from 'react';

const BEEP_FREQUENCY = 800;
const BEEP_DURATION = 0.15;
const BEEP_GAP = 0.1;
const BEEP_COUNT = 3;
const ALERT_INTERVAL_MS = 30_000;
const MUTE_DURATION_MS = 5 * 60 * 1000;

export const useOverdueAlertSound = (overdueCount: number) => {
  const [isMuted, setIsMuted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const muteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playAlertBeep = useCallback(() => {
    if (document.hidden) return;
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      for (let i = 0; i < BEEP_COUNT; i++) {
        const startTime = ctx.currentTime + i * (BEEP_DURATION + BEEP_GAP);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(BEEP_FREQUENCY, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + BEEP_DURATION);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + BEEP_DURATION);
      }
    } catch (e) {
      console.warn('Audio alert failed:', e);
    }
  }, []);

  const muteFor5Min = useCallback(() => {
    setIsMuted(true);
    if (muteTimeoutRef.current) clearTimeout(muteTimeoutRef.current);
    muteTimeoutRef.current = setTimeout(() => setIsMuted(false), MUTE_DURATION_MS);
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (overdueCount > 0 && !isMuted) {
      // Play immediately
      const timer = setTimeout(() => playAlertBeep(), 1000);
      // Then every 30s
      intervalRef.current = setInterval(() => playAlertBeep(), ALERT_INTERVAL_MS);
      return () => {
        clearTimeout(timer);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [overdueCount, isMuted, playAlertBeep]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (muteTimeoutRef.current) clearTimeout(muteTimeoutRef.current);
    };
  }, []);

  return { isMuted, muteFor5Min };
};
