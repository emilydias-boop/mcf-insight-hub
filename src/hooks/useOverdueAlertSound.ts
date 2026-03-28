import { useEffect, useRef, useState, useCallback } from 'react';

const BEEP_DURATION = 0.3;
const BEEP_GAP = 0.08;
const BEEP_COUNT = 5;
const ALERT_INTERVAL_MS = 30_000;
const MUTE_DURATION_MS = 5 * 60 * 1000;

const makeDistortionCurve = (amount: number): Float32Array => {
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
};

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

      const distortion = ctx.createWaveShaper();
      distortion.curve = makeDistortionCurve(50);
      distortion.oversample = '4x';

      for (let i = 0; i < BEEP_COUNT; i++) {
        const startTime = ctx.currentTime + i * (BEEP_DURATION + BEEP_GAP);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        // Siren: alternate between 600Hz→1200Hz and 1200Hz→600Hz
        const freqStart = i % 2 === 0 ? 600 : 1200;
        const freqEnd = i % 2 === 0 ? 1200 : 600;
        osc.frequency.setValueAtTime(freqStart, startTime);
        osc.frequency.linearRampToValueAtTime(freqEnd, startTime + BEEP_DURATION);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.8, startTime + 0.02);
        gain.gain.setValueAtTime(0.8, startTime + BEEP_DURATION - 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + BEEP_DURATION);

        osc.connect(distortion);
        distortion.connect(gain);
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
      const timer = setTimeout(() => playAlertBeep(), 1000);
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
