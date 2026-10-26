import { useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { Volume2 } from 'lucide-react';
import { getRecordingProxyUrl } from './callPresentation';
const SUPABASE_URL = 'https://rehcfgqvigfcekiipqkc.supabase.co';

// Player para gravações que só existem na API da Sonax (marcador sonax-api:<id>).
function SonaxApiRecording({ idChamada }: { idChamada: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const buscar = async () => {
    setLoading(true);
    setErro(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/get-sonax-recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ id_chamada: idChamada }),
      });
      if (!resp.ok) {
        setErro(true);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setSrc(url);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-border">
      <div className="flex items-center gap-2 mb-1">
        <Volume2 className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Gravação</span>
        {!src && !loading && !erro && (
          <button type="button" onClick={buscar} className="text-xs text-primary hover:underline">
            ouvir gravação
          </button>
        )}
        {loading && <span className="text-xs text-muted-foreground">Buscando gravação na Sonax…</span>}
        {erro && <span className="text-xs text-muted-foreground">Gravação indisponível na Sonax</span>}
      </div>
      {src && <audio controls className="w-full h-8" src={src} preload="none" />}
    </div>
  );
}

export function SonaxRecording({ recording, recordingRaw }: { recording: string | null; recordingRaw: string | null }) {
  const apiCallId = recordingRaw?.startsWith('sonax-api:') ? recordingRaw.slice('sonax-api:'.length).trim() : null;
  return <>
      {recording && recordingRaw && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Gravação</span>
            <a
              href={recordingRaw}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              abrir na Sonax
            </a>
          </div>
          <audio controls className="w-full h-8" preload="none">
            <source src={recording} type="audio/mpeg" />
          </audio>
        </div>
      )}

      {/* Sem URL pública: o webhook gravou o marcador `sonax-api:<id_chamada>`.
          Buscamos o áudio na API somente quando o usuário pede para ouvir. */}
      {!recording && apiCallId && (
        <SonaxApiRecording idChamada={apiCallId} />
      )}

  </>;
}

export function TwilioRecording({ recordingUrl }: { recordingUrl: string | null }) {
 return <>
      {recordingUrl && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Gravação</span>
          </div>
          <audio controls className="w-full h-8" src={getRecordingProxyUrl(recordingUrl)} preload="none">
            Seu navegador não suporta o player de áudio.
          </audio>
        </div>
      )}
 </>;
}
