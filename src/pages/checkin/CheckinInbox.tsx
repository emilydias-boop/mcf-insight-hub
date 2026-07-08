import { useMemo, useState, useEffect, useRef } from 'react';
import { useCheckinRooms, CheckinRoom } from '@/hooks/checkin/useCheckinRooms';
import { useCheckinMessages, useUpdateRoom } from '@/hooks/checkin/useCheckinMessages';
import { useWaTemplates, WaTemplateVariable } from '@/hooks/checkin/useWaTemplates';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, Send, User, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_atendimento', label: 'Em Atendimento' },
  { value: 'aguardando_cliente', label: 'Aguardando Cliente' },
  { value: 'concluido', label: 'Concluído' },
] as const;

const STATUS_COLOR: Record<string, string> = {
  novo: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  em_atendimento: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  aguardando_cliente: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  concluido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

function getPublicCheckinUrl(token: string) {
  const currentOrigin = window.location.origin;
  const currentHost = window.location.hostname;
  const isPrivateLovableEditor = currentHost.endsWith('lovableproject.com');
  const previewId = currentHost.split('.')[0];
  const publicOrigin = isPrivateLovableEditor
    ? `https://id-preview--${previewId}.lovable.app`
    : currentOrigin;

  return `${publicOrigin}/checkin/sala/${token}`;
}

export default function CheckinInbox() {
  return <RoomsInbox />;
}

function RoomsInbox() {
  const { data: rooms = [], isLoading } = useCheckinRooms();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!term) return true;
      return (
        r.customer_name?.toLowerCase().includes(term) ||
        r.customer_email?.toLowerCase().includes(term) ||
        r.customer_phone?.toLowerCase().includes(term)
      );
    });
  }, [rooms, search, statusFilter]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-3">
      {/* Lista */}
      <Card className="w-80 flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <h2 className="font-semibold text-sm">MCF - Atendimento</h2>
          <Input
            placeholder="Buscar nome, telefone ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="flex-1">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhuma sala.</div>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors ${selectedId === r.id ? 'bg-muted' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{r.customer_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.last_message_preview ?? 'Sem mensagens ainda'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {r.last_message_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.last_message_at), { locale: ptBR, addSuffix: false })}
                    </span>
                  )}
                  {r.unread_for_team > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[10px]">{r.unread_for_team}</Badge>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={`mt-1 text-[10px] ${STATUS_COLOR[r.status]}`}>
                {STATUS_OPTIONS.find((s) => s.value === r.status)?.label}
              </Badge>
            </button>
          ))}
        </ScrollArea>
      </Card>

      {/* Chat */}
      <div className="flex-1 flex gap-3 min-w-0">
        {selected ? (
          <>
            <ConversationPane room={selected} />
            <CustomerInfoPanel room={selected} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecione uma sala para começar
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationPane({ room }: { room: CheckinRoom }) {
  const { data: messages = [], sendMessage, markRead } = useCheckinMessages(room.id);
  const updateRoom = useUpdateRoom();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Janela de 24h: última mensagem enviada PELO cliente
  const lastCustomerAt = useMemo(() => {
    const inbound = [...messages]
      .filter((m) => m.sender_type === 'customer')
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    return inbound[0]?.sent_at ? new Date(inbound[0].sent_at) : null;
  }, [messages]);

  const windowOpen = useMemo(() => {
    if (!lastCustomerAt) return false;
    return Date.now() - lastCustomerAt.getTime() < 24 * 60 * 60 * 1000;
  }, [lastCustomerAt]);

  return (
    <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{room.customer_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {room.product_name ?? 'Produto desconhecido'}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={room.status} onValueChange={(v) => updateRoom.mutate({ id: room.id, patch: { status: v } })}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-base text-muted-foreground py-8">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_type === 'staff';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-base leading-relaxed shadow-sm ${
                  mine
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border'
                }`}
              >
                {!mine && m.sender_name && (
                  <div className="text-xs font-medium opacity-70 mb-1">{m.sender_name}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`text-xs mt-1 opacity-70 ${mine ? 'text-right' : ''}`}>
                  {format(new Date(m.sent_at), 'HH:mm', { locale: ptBR })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <Composer
        room={room}
        windowOpen={windowOpen}
        lastCustomerAt={lastCustomerAt}
        sending={sendMessage.isPending}
        onSendFree={(body) => sendMessage.mutateAsync({ body })}
        onSendTemplate={(template_sid, template_variables) =>
          sendMessage.mutateAsync({ template_sid, template_variables })
        }
      />
    </Card>
  );
}

function resolveVarSource(v: WaTemplateVariable, room: CheckinRoom): string {
  switch (v.source) {
    case 'customer_name':
      return room.customer_name ?? '';
    case 'product_name':
      return room.product_name ?? '';
    case 'purchase_date':
      return room.purchase_date
        ? format(new Date(room.purchase_date), 'dd/MM/yyyy', { locale: ptBR })
        : '';
    default:
      return v.default ?? '';
  }
}

function Composer({
  room,
  windowOpen,
  lastCustomerAt,
  sending,
  onSendFree,
  onSendTemplate,
}: {
  room: CheckinRoom;
  windowOpen: boolean;
  lastCustomerAt: Date | null;
  sending: boolean;
  onSendFree: (body: string) => Promise<any>;
  onSendTemplate: (contentSid: string, vars: Record<string, string>) => Promise<any>;
}) {
  const [text, setText] = useState('');
  const [tplId, setTplId] = useState<string>('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const { data: templates = [], isLoading: loadingTpls } = useWaTemplates(true);

  const selectedTpl = useMemo(
    () => templates.find((t) => t.id === tplId) ?? null,
    [templates, tplId],
  );

  // Reseta vars ao trocar de template
  useEffect(() => {
    if (!selectedTpl) {
      setVars({});
      return;
    }
    const initial: Record<string, string> = {};
    for (const v of selectedTpl.variables ?? []) {
      initial[String(v.index)] = resolveVarSource(v, room);
    }
    setVars(initial);
  }, [selectedTpl, room]);

  if (windowOpen) {
    const submit = async () => {
      if (!text.trim()) return;
      const body = text.trim();
      setText('');
      await onSendFree(body);
    };
    return (
      <div className="p-3 border-t flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite sua mensagem…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="resize-none text-base min-h-[52px]"
        />
        <Button onClick={submit} disabled={!text.trim() || sending} size="lg" className="h-[52px] px-4">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  const submitTemplate = async () => {
    if (!selectedTpl) return;
    // Valida variáveis obrigatórias
    for (const v of selectedTpl.variables ?? []) {
      if (!vars[String(v.index)]?.trim()) {
        toast.error(`Preencha a variável: ${v.label}`);
        return;
      }
    }
    await onSendTemplate(selectedTpl.content_sid, vars);
    setTplId('');
    setVars({});
  };

  return (
    <div className="border-t bg-muted/30">
      <div className="px-3 pt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        <div>
          {lastCustomerAt
            ? <>Janela de 24h fechada (última mensagem do cliente há{' '}
                {formatDistanceToNow(lastCustomerAt, { locale: ptBR })}).</>
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
                  Nenhum template cadastrado. Configure em Configurações → MCF Atendimento.
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
                {previewWithVars(selectedTpl.body_preview, vars)}
              </div>
            )}
            {(selectedTpl.variables ?? []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedTpl.variables.map((v) => (
                  <div key={v.index}>
                    <Label className="text-xs">{v.label} <span className="text-muted-foreground">{`{{${v.index}}}`}</span></Label>
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

function previewWithVars(preview: string, vars: Record<string, string>): string {
  let out = preview;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v || `{{${k}}}`);
  }
  return out;
}

function CustomerInfoPanel({ room }: { room: CheckinRoom }) {
  const url = getPublicCheckinUrl(room.access_token);
  return (
    <Card className="w-72 p-4 shrink-0 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{room.customer_name}</div>
          <div className="text-xs text-muted-foreground">Cliente MCF</div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <InfoRow label="E-mail" value={room.customer_email} />
        <InfoRow label="Telefone" value={room.customer_phone} />
        <InfoRow label="Produto" value={room.product_name} />
        <InfoRow
          label="Data da compra"
          value={room.purchase_date ? format(new Date(room.purchase_date), 'dd/MM/yyyy', { locale: ptBR }) : null}
        />
      </div>

      <div className="pt-2 border-t space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Link do cliente</div>
        <div className="flex gap-1">
          <Input value={url} readOnly className="h-8 text-xs" />
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success('Link copiado');
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value ?? '—'}</div>
    </div>
  );
}