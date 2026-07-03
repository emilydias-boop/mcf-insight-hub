import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCustomerRoom } from '@/hooks/checkin/useCustomerRoom';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CustomerRoom() {
  const { token } = useParams<{ token: string }>();
  const { room, messages, loading, error, send } = useCustomerRoom(token ?? null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await send(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-base">Carregando…</div>;
  if (error || !room) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <div className="text-xl font-semibold mb-2">Sala não encontrada</div>
        <div className="text-base text-muted-foreground">Verifique o link recebido ou entre em contato com nosso suporte.</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-muted/20 flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-5 py-5 shadow sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-base sm:text-lg font-medium opacity-90 tracking-wide">Check-in MCF</div>
          <div className="font-bold text-2xl sm:text-2xl mt-1 leading-tight">Olá, {room.customer_name.split(' ')[0]}</div>
          {room.product_name && (
            <div className="text-base sm:text-base opacity-90 mt-1">{room.product_name}</div>
          )}
        </div>
      </header>

      {/* Boas-vindas */}
      <div className="max-w-2xl w-full mx-auto px-4 pt-4">
        <div className="bg-card border rounded-lg p-4 text-base leading-relaxed text-muted-foreground">
          Este é o seu espaço exclusivo para tirar dúvidas sobre o MCF. Nossa equipe responde por aqui — todo o histórico fica guardado para você consultar quando quiser.
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto space-y-3">
        {messages.map((m) => {
          const mine = m.sender_type === 'customer';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[17px] sm:text-base leading-relaxed shadow-sm ${
                mine ? 'bg-primary text-primary-foreground' : 'bg-card border'
              }`}>
                {!mine && m.sender_name && (
                  <div className="text-sm font-medium opacity-70 mb-1">{m.sender_name}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`text-xs mt-1 flex items-center gap-1 opacity-70 ${mine ? 'justify-end' : ''}`}>
                  {format(new Date(m.sent_at), 'HH:mm', { locale: ptBR })}
                  {mine && (
                    m.read_at ? <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                    : m.delivered_at ? <CheckCheck className="h-3.5 w-3.5" />
                    : <Check className="h-3.5 w-3.5" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="bg-card border-t p-3 sticky bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite sua mensagem…"
            rows={2}
            className="resize-none text-[17px] sm:text-base min-h-[56px] py-3 px-4 rounded-2xl"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button onClick={submit} disabled={!text.trim() || sending} size="lg" className="h-[56px] w-[56px] p-0 rounded-full shrink-0">
            <Send className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}