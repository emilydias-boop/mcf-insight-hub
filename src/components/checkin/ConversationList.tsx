import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WaConversation, WaScope } from '@/hooks/wa/useWaConversations';
import { WA_STATUS_COLOR, WA_STATUS_OPTIONS, formatPhone } from './waLabels';

interface Props {
  conversations: WaConversation[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  scope: WaScope;
  onScopeChange: (v: WaScope) => void;
  canSeeAll: boolean;
}

export function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  scope,
  onScopeChange,
  canSeeAll,
}: Props) {
  return (
    <Card className="w-80 shrink-0 flex flex-col overflow-hidden">
      <div className="p-3 border-b space-y-2">
        <h2 className="font-semibold text-sm">MCF - Atendimento</h2>

        {canSeeAll && (
          <Select value={scope} onValueChange={(v) => onScopeChange(v as WaScope)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Minhas conversas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Input
          placeholder="Buscar nome ou telefone…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8"
        />
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {WA_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && conversations.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa.</div>
        )}
        {conversations.map((c) => {
          // Linha com não lidas fica em destaque: só o badge não chama atenção.
          const naoLida = (c.unread_count ?? 0) > 0;
          return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors ${
              selectedId === c.id ? 'bg-muted' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className={`text-sm truncate ${naoLida ? 'font-semibold text-foreground' : 'font-medium'}`}>
                  {c.contact_name?.trim() || formatPhone(c.phone_e164)}
                </div>
                <div className={`text-xs truncate ${naoLida ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
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
                  <Badge className="h-4 min-w-4 px-1 text-[10px]">{c.unread_count}</Badge>
                )}
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${WA_STATUS_COLOR[c.status] ?? ''}`}>
                {WA_STATUS_OPTIONS.find((s) => s.value === c.status)?.label ?? c.status}
              </Badge>
              {!c.deal_id && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  sem negócio
                </Badge>
              )}
            </div>
          </button>
          );
        })}
      </ScrollArea>
    </Card>
  );
}