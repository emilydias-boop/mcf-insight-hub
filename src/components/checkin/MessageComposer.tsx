import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Info, Loader2, Mic, Paperclip, Send, Square, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCheckinTemplates, CheckinTemplateVariable } from '@/hooks/checkin/useCheckinTemplates';
import { WaConversation } from '@/hooks/wa/useWaConversations';
import { get24hWindow } from './waLabels';
import { useAudioRecorder } from '@/hooks/wa/useAudioRecorder';
import {
  WA_MEDIA_ACCEPT_ATTR,
  formatBytes,
  formatDuration,
  validateWaMedia,
} from '@/lib/waMedia';

/**
 * As fontes product_name / purchase_date não existem no modelo de conversa por pessoa,
 * então ficam em branco para o operador preencher.
 */
function resolveVarSource(v: CheckinTemplateVariable, conversation: WaConversation): string {
  switch (v.source) {
    case 'customer_name':
      return conversation.contact_name ?? '';
    default:
      return '';
  }
}

function previewWithVars(
  preview: string,
  variables: CheckinTemplateVariable[],
  vars: Record<string, string>,
): string {
  let out = preview;
  for (const v of variables) {
    const filled = vars[String(v.index)];
    out = out.split(`{{${v.name}}}`).join(filled || `{{${v.name}}}`);
    out = out.split(`{{${v.index}}}`).join(filled || `{{${v.index}}}`);
  }
  return out;
}

interface Props {
  conversation: WaConversation;
  now: number;
  sending: boolean;
  forceTemplateMode?: boolean;
  /** resolve para true quando o envio foi bem-sucedido */
  onSendFree: (body: string) => Promise<boolean>;
  onSendTemplate: (contentSid: string, vars: Record<string, string>) => Promise<boolean>;
  onSendMedia: (input: {
    file: File | Blob;
    filename?: string;
    mediaType?: string;
    caption?: string;
    durationSeconds?: number;
  }) => Promise<boolean>;
}

export function MessageComposer({
  conversation,
  now,
  sending,
  forceTemplateMode,
  onSendFree,
  onSendTemplate,
  onSendMedia,
}: Props) {
  const [text, setText] = useState('');
  const [tplId, setTplId] = useState<string>('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const { data: templates = [], isLoading: loadingTpls } = useCheckinTemplates();
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (recorder.error) toast.error(recorder.error);
  }, [recorder.error]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const invalid = validateWaMedia(f);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setFile(f);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const { open: windowOpen, critical, label: windowLabel, lastInboundAt } = get24hWindow(
    conversation.last_inbound_at,
    now,
  );
  const canSendFree = windowOpen && !forceTemplateMode;

  const selectedTpl = useMemo(
    () => templates.find((t) => t.id === tplId) ?? null,
    [templates, tplId],
  );

  useEffect(() => {
    if (!selectedTpl) {
      setVars({});
      return;
    }
    const initial: Record<string, string> = {};
    for (const v of selectedTpl.variables ?? []) {
      initial[String(v.index)] = resolveVarSource(v, conversation);
    }
    setVars(initial);
    // depende de tplId (string) e do id da conversa: objetos derivados mudam a cada refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId, conversation.id]);

  if (canSendFree) {
    const submit = async () => {
      if (recorder.result) {
        const audio = recorder.result;
        if (audio.conversionFailed) {
          toast.error('O áudio não foi convertido para MP3. Tente converter novamente antes de enviar.');
          return;
        }
        const ok = await onSendMedia({
          file: audio.blob,
          filename: `audio-${Date.now()}.${audio.encoding === 'ogg' ? 'ogg' : 'mp3'}`,
          mediaType: audio.mediaType,
          caption: text.trim() || undefined,
          durationSeconds: audio.durationSeconds,
        });
        if (ok) {
          recorder.discard();
          setText('');
        }
        return;
      }
      if (file) {
        const ok = await onSendMedia({ file, caption: text.trim() || undefined });
        if (ok) {
          clearFile();
          setText('');
        }
        return;
      }
      if (!text.trim()) return;
      const body = text.trim();
      const ok = await onSendFree(body);
      if (ok) setText('');
    };
    const audioBlocked = !!recorder.result?.conversionFailed;
    const hasAttachment = !!file || (!!recorder.result && !audioBlocked);
    const stopRecording = () => {
      void recorder.stop().catch(() => {
        /* erro já exibido pelo hook via `error` */
      });
    };
    return (
      <div className="p-3 border-t space-y-2">
        {critical && (
          <div className="flex items-center gap-2 text-xs text-destructive font-medium">
            <Info className="h-4 w-4 shrink-0" />
            A janela de 24h está fechando ({windowLabel}). Depois disso só será possível enviar template aprovado.
          </div>
        )}
        {file && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            {filePreview ? (
              <img src={filePreview} alt={file.name} className="h-10 w-10 rounded object-cover" />
            ) : (
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{file.name}</div>
              <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={clearFile} disabled={sending}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {recorder.recording && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="font-medium">Gravando… {formatDuration(recorder.elapsed) || '0:00'}</span>
            {recorder.remaining <= recorder.warnRemaining && (
              <span className="text-xs font-medium text-destructive">
                resta {formatDuration(recorder.remaining) || '0:00'} (máx.{' '}
                {Math.round(recorder.maxSeconds / 60)} min)
              </span>
            )}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={stopRecording}>
              <Square className="h-3.5 w-3.5 mr-1.5" /> Parar
            </Button>
            <Button variant="ghost" size="icon" onClick={recorder.discard}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        {recorder.processing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Convertendo áudio…
          </div>
        )}
        {recorder.result && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <audio controls src={recorder.result.url} className="h-9 flex-1 min-w-0" />
            {audioBlocked ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium text-destructive">
                  Conversão falhou — áudio preservado
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sending || recorder.processing}
                  onClick={() => void recorder.retryEncode()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDuration(recorder.result.durationSeconds)} ·{' '}
                {recorder.result.encoding === 'ogg' ? 'OGG' : 'MP3'}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={recorder.discard} disabled={sending}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={WA_MEDIA_ACCEPT_ATTR}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-[52px] w-[52px] shrink-0"
          title="Anexar arquivo"
          disabled={sending || recorder.recording || recorder.processing || !!recorder.result}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant={recorder.recording ? 'destructive' : 'outline'}
          size="icon"
          className="h-[52px] w-[52px] shrink-0"
          title={recorder.recording ? 'Parar gravação' : 'Gravar áudio'}
          disabled={sending || !!file || recorder.processing || !!recorder.result}
          onClick={() => (recorder.recording ? stopRecording() : void recorder.start())}
        >
          {recorder.recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={hasAttachment ? 'Legenda (opcional)…' : 'Digite sua mensagem…'}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="resize-none text-base min-h-[52px]"
        />
        <Button
          onClick={submit}
          disabled={(!text.trim() && !hasAttachment) || sending || recorder.recording}
          size="lg"
          className="h-[52px] px-4"
        >
          <Send className="h-5 w-5" />
        </Button>
        </div>
      </div>
    );
  }

  const submitTemplate = async () => {
    if (!selectedTpl) return;
    for (const v of selectedTpl.variables ?? []) {
      if (!vars[String(v.index)]?.trim()) {
        toast.error(`Preencha a variável: ${v.label}`);
        return;
      }
    }
    const ok = await onSendTemplate(selectedTpl.content_sid, vars);
    if (!ok) return;
    setTplId('');
    setVars({});
  };

  return (
    <div className="border-t bg-muted/30">
      {text.trim() && (
        <div className="mx-3 mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
          <div className="font-medium">
            A janela fechou — envie um template aprovado para reabrir a conversa. Você havia escrito:
          </div>
          <div className="whitespace-pre-wrap break-words rounded bg-background border p-2">{text}</div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  toast.success('Texto copiado');
                } catch {
                  toast.error('Não foi possível copiar');
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-2" />
              Copiar texto
            </Button>
          </div>
        </div>
      )}
      <div className="px-3 pt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        <div>
          {lastInboundAt
            ? <>Janela de 24h fechada (última mensagem do cliente há{' '}
                {formatDistanceToNow(lastInboundAt, { locale: ptBR })}).</>
            : <>O cliente ainda não iniciou conversa neste número.</>}
          {' '}Envie um <b>template aprovado</b> para reabrir o contato.
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Template</Label>
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={loadingTpls ? 'Carregando…' : 'Escolha um template aprovado'} />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum template de WhatsApp aprovado disponível. Cadastre e submeta em Administração → Automações.
                </div>
              )}
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTpl && (
          <>
            {selectedTpl.body_preview && (
              <div className="text-xs bg-background rounded-md border p-3 whitespace-pre-wrap">
                {previewWithVars(selectedTpl.body_preview, selectedTpl.variables, vars)}
              </div>
            )}
            {(selectedTpl.variables ?? []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedTpl.variables.map((v) => (
                  <div key={v.index}>
                    <Label className="text-xs">
                      {v.label} <span className="text-muted-foreground">{`{{${v.name}}}`}</span>
                    </Label>
                    <Input
                      value={vars[String(v.index)] ?? ''}
                      onChange={(e) =>
                        setVars((prev) => ({ ...prev, [String(v.index)]: e.target.value }))
                      }
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={submitTemplate} disabled={sending} size="sm">
                <Send className="h-4 w-4 mr-2" />
                Enviar template
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}