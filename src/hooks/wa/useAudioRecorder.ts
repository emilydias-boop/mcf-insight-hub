import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Gravação de áudio para envio no WhatsApp.
 *
 * O WhatsApp NÃO aceita `audio/webm` — que é exatamente o que o MediaRecorder
 * do Chrome/Edge produz por padrão. Por isso:
 *  - Firefox (suporta `audio/ogg;codecs=opus`): grava direto em ogg.
 *  - Chrome/Edge: grava no container nativo, decodifica via Web Audio para PCM
 *    mono 22.05kHz e codifica em MP3 no navegador com `lamejs` (CDN).
 * Em nenhuma hipótese enviamos webm.
 */
export type WaAudioEncoding = 'ogg' | 'mp3';

export function detectAudioEncoding(): WaAudioEncoding {
  if (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
  ) {
    return 'ogg';
  }
  return 'mp3';
}

const TARGET_SAMPLE_RATE = 22050;
const LAMEJS_CDN = 'https://esm.sh/lamejs@1.2.1';

type LameModule = {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
    encodeBuffer: (samples: Int16Array) => Uint8Array | number[];
    flush: () => Uint8Array | number[];
  };
};

async function loadLame(): Promise<LameModule> {
  const mod: any = await import(/* @vite-ignore */ LAMEJS_CDN);
  const lame = mod?.Mp3Encoder ? mod : (mod?.default ?? mod);
  if (!lame?.Mp3Encoder) throw new Error('Não foi possível carregar o codificador MP3.');
  return lame as LameModule;
}

/** Decodifica o blob gravado e devolve PCM mono no sample rate alvo. */
async function toMonoPcm(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const frames = Math.max(
      1,
      Math.round((decoded.duration * TARGET_SAMPLE_RATE)),
    );
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return { samples: rendered.getChannelData(0).slice(0), sampleRate: TARGET_SAMPLE_RATE };
  } finally {
    void ctx.close();
  }
}

async function encodeMp3(blob: Blob): Promise<Blob> {
  const [{ Mp3Encoder }, pcm] = await Promise.all([loadLame(), toMonoPcm(blob)]);
  const encoder = new Mp3Encoder(1, pcm.sampleRate, 64);
  const pcm16 = new Int16Array(pcm.samples.length);
  for (let i = 0; i < pcm.samples.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm.samples[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const chunks: Uint8Array[] = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm16.length; i += BLOCK) {
    const buf = encoder.encodeBuffer(pcm16.subarray(i, i + BLOCK));
    if (buf.length > 0) chunks.push(new Uint8Array(buf as Uint8Array));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail as Uint8Array));
  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

export interface RecordedAudio {
  blob: Blob;
  /** 'audio/ogg' ou 'audio/mpeg' */
  mediaType: string;
  durationSeconds: number;
  encoding: WaAudioEncoding;
  url: string;
}

export function useAudioRecorder() {
  const encoding = detectAudioEncoding();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordedAudio | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
    if (result) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      const mimeType =
        encoding === 'ogg' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : undefined;
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (e) {
      releaseStream();
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Permissão de microfone negada pelo navegador.'
          : 'Não foi possível acessar o microfone.',
      );
    }
  }, [encoding, result]);

  const stop = useCallback(async (): Promise<RecordedAudio | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;
    stopTimer();
    setRecording(false);
    setProcessing(true);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));

    const raw = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }));
      rec.stop();
    });
    recorderRef.current = null;
    releaseStream();

    try {
      const isOgg = (rec.mimeType || '').includes('ogg');
      const blob = isOgg ? new Blob([raw], { type: 'audio/ogg' }) : await encodeMp3(raw);
      const out: RecordedAudio = {
        blob,
        mediaType: isOgg ? 'audio/ogg' : 'audio/mpeg',
        durationSeconds,
        encoding: isOgg ? 'ogg' : 'mp3',
        url: URL.createObjectURL(blob),
      };
      setResult(out);
      return out;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar o áudio gravado.');
      return null;
    } finally {
      setProcessing(false);
    }
  }, []);

  const discard = useCallback(() => {
    stopTimer();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    recorderRef.current = null;
    releaseStream();
    setRecording(false);
    setElapsed(0);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
    };
  }, []);

  return { encoding, recording, processing, elapsed, error, result, start, stop, discard };
}