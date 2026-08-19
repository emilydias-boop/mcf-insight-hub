import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Gravação de áudio para envio no WhatsApp.
 *
 * O WhatsApp NÃO aceita `audio/webm` — que é exatamente o que o MediaRecorder
 * do Chrome/Edge produz por padrão. Por isso:
 *  - Firefox (suporta `audio/ogg;codecs=opus`): grava direto em ogg.
 *  - Chrome/Edge: grava no container nativo, decodifica via Web Audio para PCM
 *    mono 22.05kHz e codifica em MP3 no navegador com `lamejs` (CDN).
 * Em nenhuma hipótese enviamos webm como áudio válido: se a conversão falhar,
 * o blob bruto é preservado (para nova tentativa) mas marcado como inválido.
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
/** Teto de gravação: 3 minutos. Evita codificar minutos de MP3 para o envio ser rejeitado por tamanho. */
export const MAX_RECORDING_SECONDS = 180;
/** A partir de quantos segundos restantes mostramos a contagem regressiva. */
export const RECORDING_WARN_REMAINING = 30;
const STOP_TIMEOUT_MS = 5000;

interface Mp3EncoderInstance {
  encodeBuffer: (samples: Int16Array) => Uint8Array | number[];
  flush: () => Uint8Array | number[];
}

interface LameModule {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => Mp3EncoderInstance;
}

function isLameModule(value: unknown): value is LameModule {
  return typeof (value as LameModule | null)?.Mp3Encoder === 'function';
}

let lameCache: LameModule | null = null;

async function loadLame(): Promise<LameModule> {
  if (lameCache) return lameCache;
  const mod: unknown = await import(/* @vite-ignore */ LAMEJS_CDN);
  const candidate = isLameModule(mod)
    ? mod
    : (mod as { default?: unknown } | null)?.default;
  if (!isLameModule(candidate)) {
    throw new Error('Não foi possível carregar o codificador MP3.');
  }
  lameCache = candidate;
  return candidate;
}

/** Decodifica o blob gravado e devolve PCM mono no sample rate alvo. */
async function toMonoPcm(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const frames = Math.max(1, Math.round(decoded.duration * TARGET_SAMPLE_RATE));
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
  /** 'audio/ogg' ou 'audio/mpeg' — quando `conversionFailed`, é o MIME bruto e NÃO pode ser enviado */
  mediaType: string;
  durationSeconds: number;
  encoding: WaAudioEncoding;
  url: string;
  /** true quando a conversão para MP3 falhou: o áudio bruto foi preservado para nova tentativa */
  conversionFailed?: boolean;
}

export function useAudioRecorder() {
  const encoding = useMemo(() => detectAudioEncoding(), []);
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
  const rawRef = useRef<Blob | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const stopFnRef = useRef<() => void>(() => {});

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

  const publishResult = useCallback((out: RecordedAudio) => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = out.url;
    setResult(out);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
    rawRef.current = null;
    try {
      // pré-carrega o codificador ANTES do usuário falar: se o CDN estiver fora, falha aqui
      if (encoding === 'mp3') await loadLame();

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
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_RECORDING_SECONDS) {
          setError(`Gravação encerrada automaticamente ao atingir ${MAX_RECORDING_SECONDS / 60} minutos.`);
          stopFnRef.current();
        }
      }, 250);
    } catch (e) {
      releaseStream();
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Permissão de microfone negada pelo navegador.'
          : e instanceof Error && e.message.includes('codificador MP3')
            ? 'Não foi possível carregar o codificador de áudio. Verifique a conexão e tente novamente.'
            : 'Não foi possível acessar o microfone.',
      );
    }
  }, [encoding]);

  /** Encerra o recorder e devolve o blob bruto. Nunca fica pendurado: tem timeout. */
  const collectRaw = (rec: MediaRecorder): Promise<Blob> =>
    new Promise<Blob>((resolve) => {
      const mime = rec.mimeType || 'audio/webm';
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(new Blob(chunksRef.current, { type: mime }));
      };
      const timeoutId = window.setTimeout(finish, STOP_TIMEOUT_MS);
      rec.onstop = finish;
      try {
        if (rec.state !== 'inactive') rec.stop();
        else finish();
      } catch {
        // InvalidStateError etc.: usa o que já foi capturado
        finish();
      }
    });

  const finalize = useCallback(
    async (raw: Blob, durationSeconds: number): Promise<RecordedAudio | null> => {
      const isOgg = raw.type.includes('ogg');
      try {
        const blob = isOgg ? new Blob([raw], { type: 'audio/ogg' }) : await encodeMp3(raw);
        const out: RecordedAudio = {
          blob,
          mediaType: isOgg ? 'audio/ogg' : 'audio/mpeg',
          durationSeconds,
          encoding: isOgg ? 'ogg' : 'mp3',
          url: URL.createObjectURL(blob),
        };
        publishResult(out);
        return out;
      } catch (e) {
        // não descarta o áudio: mantém o bruto para nova tentativa de conversão
        const out: RecordedAudio = {
          blob: raw,
          mediaType: raw.type || 'audio/webm',
          durationSeconds,
          encoding: 'mp3',
          url: URL.createObjectURL(raw),
          conversionFailed: true,
        };
        publishResult(out);
        setError(
          e instanceof Error && e.message
            ? `Falha ao converter o áudio: ${e.message}`
            : 'Falha ao converter o áudio gravado.',
        );
        return out;
      }
    },
    [publishResult],
  );

  const stop = useCallback(async (): Promise<RecordedAudio | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;
    recorderRef.current = null;
    stopTimer();
    setRecording(false);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));

    try {
      setProcessing(true);
      const raw = await collectRaw(rec);
      rawRef.current = raw;
      return await finalize(raw, durationSeconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar o áudio gravado.');
      return null;
    } finally {
      releaseStream();
      setProcessing(false);
    }
  }, [finalize]);

  useEffect(() => {
    stopFnRef.current = () => {
      void stop().catch(() => {
        /* já tratado via setError */
      });
    };
  }, [stop]);

  /** Nova tentativa de conversão quando o CDN/codificador falhou. */
  const retryEncode = useCallback(async (): Promise<RecordedAudio | null> => {
    const raw = rawRef.current;
    if (!raw || !result?.conversionFailed) return result;
    setError(null);
    setProcessing(true);
    try {
      return await finalize(raw, result.durationSeconds);
    } finally {
      setProcessing(false);
    }
  }, [finalize, result]);

  const discard = useCallback(() => {
    stopTimer();
    const rec = recorderRef.current;
    if (rec) {
      rec.onstop = null;
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* recorder já inativo */
      }
    }
    recorderRef.current = null;
    releaseStream();
    setRecording(false);
    setElapsed(0);
    rawRef.current = null;
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
      // a object URL do último resultado segura o blob inteiro em memória
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
    };
  }, []);

  const remaining = Math.max(0, MAX_RECORDING_SECONDS - elapsed);

  return {
    encoding,
    recording,
    processing,
    elapsed,
    remaining,
    maxSeconds: MAX_RECORDING_SECONDS,
    warnRemaining: RECORDING_WARN_REMAINING,
    error,
    result,
    start,
    stop,
    retryEncode,
    discard,
  };
}
