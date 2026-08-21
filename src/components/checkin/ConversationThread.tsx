import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isToday, isYesterday, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Check, CheckCheck, Clock } from 'lucide-react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { WaConversation } from '@/hooks/wa/useWaConversations';
import type { WaConversationStatus } from '@/hooks/wa/useWaConversations';
import { WaMessage, useWaMediaUrl } from '@/hooks/wa/useWaMessages';
import { WA_STATUS_OPTIONS, formatPhone, get24hWindow } from './waLabels';
import {
  formatBytes,
  formatDuration,
  isMediaPlaceholder,
  mediaKindFromType,
} from '@/lib/waMedia';

function MediaBlock({ message }: { message: WaMessage }) {
  const { data: url, isLoading, isError } = useWaMediaUrl(message.media_path);
  const [zoom, setZoom] = useState(false);
  const kind = mediaKindFromType(message.media_type ?? '');
  const name = message.media_filename ?? 'arquivo';

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs opacity-80 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando anexo…
      </div>
    );
  }
  if (isError || !url) {
    return <div className="text-xs opacity-80 py-2">Não foi possível carregar o anexo.</div>;
  }

  if (kind === 'image') {
    return (
      <>
        <button type="button" onClick={() => setZoom(true)} className="block">
          <img
            src={url}
            alt={name}
            className="rounded-lg max-h-52 max-w-full object-cover cursor-zoom-in"
          />
        </button>
        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogContent className="max-w-3xl p-2">
            <img src={url} alt={name} className="w-full h-auto rounded" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="flex items-center gap-2">
        <audio controls src={url} className="h-9 max-w-[240px]" />
        {message.media_duration_seconds ? (
          <span className="text-xs opacity-80">{formatDuration(message.media_duration_seconds)}</span>
        ) : null}
      </div>
    );
  }

  if (kind === 'video') {
    return <video controls src={url} className="rounded-lg max-h-60 max-w-full" />;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2 text-foreground">
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-sm truncate max-w-[180px]">{name}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(message.media_size_bytes)}</div>
      </div>
      <Button asChild variant="ghost" size="icon" className="shrink-0">
        <a href={url} target="_blank" rel="noreferrer" download={name}>
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

function DeliveryIndicator({ message }: { message: WaMessage }) {
  const status = message.status;
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> falhou
      </span>
    );
  }
  if (status === 'read') {
    return (
      <span className="inline-flex items-center gap-1" title="Lida">
        <CheckCheck className="h-3.5 w-3.5 text-sky-300" /> lida
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1" title="Entregue">
        <CheckCheck className="h-3.5 w-3.5" /> entregue
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1" title="Enviada">
        <Check className="h-3.5 w-3.5" /> enviada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" title="Pendente">
      <Clock className="h-3.5 w-3.5" />
    </span>
  );
}

interface Props {
  conversation: WaConversation;
  messages: WaMessage[];
  now: number;
  onStatusChange: (status: WaConversationStatus) => void;
  children?: ReactNode; // composer
}

export function ConversationThread({ conversation, messages, now, onStatusChange, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const windowInfo = get24hWindow(conversation.last_inbound_at, now);

  // Rótulo de separador de data em português (padrão WhatsApp).
  // "Hoje"/"Ontem" usam date-fns (dia civil, não diferença de 24h);
  // demais usam o dia civil do ano corrente ou completo.
  const rotuloData = (d: Date): string => {
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    if (isSameYear(d, new Date(now))) {
      return format(d, "d 'de' MMMM", { locale: ptBR });
    }
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  // Lista unificada de itens: separador antes de cada novo dia civil + a mensagem.
  // Derivada em useMemo para não recalcular a cada render.
  const itens = useMemo(() => {
    let diaAnterior: string | null = null;
    const resultado: Array<
      | { tipo: 'separador'; id: string; rotulo: string }
      | { tipo: 'mensagem'; id: string; mensagem: WaMessage }
    > = [];
    for (const m of messages) {
      const data = new Date(m.created_at);
      const chaveDia = format(data, 'yyyy-MM-dd');
      if (chaveDia !== diaAnterior) {
        resultado.push({
          tipo: 'separador',
          id: `sep-${m.id}`,
          rotulo: rotuloData(data),
        });
        diaAnterior = chaveDia;
      }
      resultado.push({ tipo: 'mensagem', id: m.id, mensagem: m });
    }
    return resultado;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // primeiro render / troca de conversa: sempre ao fim
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    wasNearBottomRef.current = true;
    el.scrollTop = el.scrollHeight;
  }, [conversation.id]);

  // mensagem nova: própria sempre rola; inbound só se já estava perto do fim
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const isOwn = last?.direction === 'outbound';
    if (isOwn || wasNearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // altura do container pode mudar sem scroll (composer -> modo template)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  return (
    <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {conversation.contact_name?.trim() || formatPhone(conversation.phone_e164)}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {formatPhone(conversation.phone_e164)}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className={
              !windowInfo.open
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : windowInfo.critical
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            }
          >
            {windowInfo.label}
          </Badge>
          <Select
            value={conversation.status}
            onValueChange={(v) => onStatusChange(v as WaConversationStatus)}
          >
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WA_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20"
      >
        {messages.length === 0 && (
          <div className="text-center text-base text-muted-foreground py-8">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        )}
        {messages.map((m) => {
          const outbound = m.direction === 'outbound';
          const failed = outbound && m.status === 'failed';
          const hasMedia = !!m.media_path;
          // quando é mídia sem legenda o backend grava rótulos como "[imagem]"
          const caption = hasMedia ? (isMediaPlaceholder(m.body) ? null : m.body) : m.body;
          return (
            <div key={m.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-base leading-relaxed shadow-sm ${
                  failed
                    ? 'bg-destructive/10 border border-destructive text-foreground'
                    : outbound
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                }`}
              >
                {outbound && m.sent_by_name && (
                  <div className="text-xs font-medium opacity-70 mb-1">{m.sent_by_name}</div>
                )}
                {hasMedia && (
                  <div className={caption ? 'mb-2' : ''}>
                    <MediaBlock message={m} />
                  </div>
                )}
                {caption && <div className="whitespace-pre-wrap break-words">{caption}</div>}
                {failed && m.error_message && (
                  <div className="mt-2 text-xs text-destructive font-medium break-words">
                    Falha no envio: {m.error_message}
                  </div>
                )}
                <div
                  className={`text-xs mt-1 opacity-80 flex items-center gap-2 ${
                    outbound ? 'justify-end' : ''
                  }`}
                >
                  <span>{format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}</span>
                  {outbound && <DeliveryIndicator message={m} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {children}
    </Card>
  );
}