import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Phone, Plus } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useWaConversations,
  useWaMessages,
  useSendWaMessage,
  useMarkWaConversationRead,
  useHasMcfAtendimentoAccess,
  type WaConversation,
} from '@/hooks/whatsapp/useWhatsapp';
import { WaStartConversationDialog } from './WaStartConversationDialog';

export default function WhatsAppPanel() {
  const { data: hasAccess, isLoading: loadingAccess } = useHasMcfAtendimentoAccess();
  const { data: conversations = [], isLoading } = useWaConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [startOpen, setStartOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter(
      (c) =>
        c.contact_name?.toLowerCase().includes(term) ||
        c.phone_e164.toLowerCase().includes(term) ||
        c.last_message_preview?.toLowerCase().includes(term),
    );
  }, [conversations, search]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  if (loadingAccess) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!hasAccess) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
        Você não tem acesso ao canal WhatsApp do MCF - Atendimento.
        <div className="text-xs mt-2">Solicite acesso a um administrador.</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-3">
      <Card className="w-80 flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              WhatsApp
            </h2>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setStartOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova
            </Button>
          </div>
          <Input
            placeholder="Buscar nome, telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="flex-1">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhuma conversa. Clique em "Nova" para começar.
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors ${
                selectedId === c.id ? 'bg-muted' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {c.contact_name ?? c.phone_e164}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.last_direction === 'outbound' && '→ '}
                    {c.last_message_preview ?? 'Sem mensagens ainda'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {c.last_message_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })}
                    </span>
                  )}
                  {c.unread_count > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[10px] bg-emerald-600">{c.unread_count}</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </Card>

      <div className="flex-1 min-w-0">
        {selected ? (
          <ChatPane conversation={selected} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </div>

      <WaStartConversationDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}

function ChatPane({ conversation }: { conversation: WaConversation }) {
  const { data: messages = [] } = useWaMessages(conversation.id);
  const send = useSendWaMessage();
  const markRead = useMarkWaConversationRead();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversation.unread_count > 0) markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      await send.mutateAsync({ conversation_id: conversation.id, body });
    } catch (err) {
      setText(body);
      const { toast } = await import('sonner');
      toast.error('Falha ao enviar mensagem', { description: (err as Error).message });
    }
  };

  return (
    <Card className="h-full flex flex-col min-w-0 overflow-hidden">
      <div className="p-3 border-b flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <Phone className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{conversation.contact_name ?? conversation.phone_e164}</div>
          <div className="text-xs text-muted-foreground truncate">{conversation.phone_e164}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-base text-muted-foreground py-8">Nenhuma mensagem.</div>
        )}
        {messages.map((m) => {
          const mine = m.direction === 'outbound';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-base leading-relaxed shadow-sm ${
                  mine ? 'bg-emerald-600 text-white' : 'bg-card border'
                }`}
              >
                {mine && m.sent_by_name && (
                  <div className="text-xs font-medium opacity-80 mb-1">{m.sent_by_name}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`text-xs mt-1 opacity-70 ${mine ? 'text-right' : ''}`}>
                  {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                  {m.status === 'failed' && <span className="ml-1 text-red-300">(falhou)</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
        <Button
          onClick={submit}
          disabled={!text.trim() || send.isPending}
          size="lg"
          className="h-[52px] px-4 bg-emerald-600 hover:bg-emerald-700"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </Card>
  );
}