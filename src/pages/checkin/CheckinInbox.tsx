import { useMemo, useState, useEffect, useRef } from 'react';
import { useCheckinRooms, CheckinRoom } from '@/hooks/checkin/useCheckinRooms';
import { useCheckinMessages, useUpdateRoom } from '@/hooks/checkin/useCheckinMessages';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, Send, User } from 'lucide-react';
import { toast } from 'sonner';

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
          <h2 className="font-semibold text-sm">Check-in MCF</h2>
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
  const [text, setText] = useState('');
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

  const submit = async () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText('');
    await sendMessage.mutateAsync({ body });
  };

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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_type === 'staff';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  mine
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border'
                }`}
              >
                {!mine && m.sender_name && (
                  <div className="text-[10px] font-medium opacity-70 mb-0.5">{m.sender_name}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`text-[10px] mt-1 opacity-70 ${mine ? 'text-right' : ''}`}>
                  {format(new Date(m.sent_at), 'HH:mm', { locale: ptBR })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="p-3 border-t flex gap-2">
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
          className="resize-none"
        />
        <Button onClick={submit} disabled={!text.trim() || sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
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