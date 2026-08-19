import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWaConversations, useUpdateWaConversation, WaConversation, WaScope } from '@/hooks/wa/useWaConversations';
import { useWaMessages, WaSendError } from '@/hooks/wa/useWaMessages';
import { ConversationList } from '@/components/checkin/ConversationList';
import { ConversationThread } from '@/components/checkin/ConversationThread';
import { MessageComposer } from '@/components/checkin/MessageComposer';
import { ContactPanel } from '@/components/checkin/ContactPanel';

export default function CheckinInbox() {
  const { role } = useAuth();
  const canSeeAll = role === 'admin' || role === 'manager';

  const [scope, setScope] = useState<WaScope>('mine');
  const { data: conversations = [], isLoading } = useWaConversations(scope);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!term) return true;
      return (
        c.contact_name?.toLowerCase().includes(term) ||
        c.phone_e164?.toLowerCase().includes(term)
      );
    });
  }, [conversations, search, statusFilter]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-3">
      <ConversationList
        conversations={filtered}
        isLoading={isLoading}
        selectedId={selectedId}
        onSelect={setSelectedId}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        scope={scope}
        onScopeChange={setScope}
        canSeeAll={canSeeAll}
      />

      <div className="flex-1 flex gap-3 min-w-0">
        {selected ? (
          <>
            <ConversationPane conversation={selected} />
            <ContactPanel conversation={selected} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecione uma conversa para começar
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationPane({ conversation }: { conversation: WaConversation }) {
  const { data: messages = [], sendMessage, markRead } = useWaMessages(conversation.id);
  const updateConversation = useUpdateWaConversation();
  const [forceTemplateMode, setForceTemplateMode] = useState(false);

  useEffect(() => {
    markRead.mutate();
    setForceTemplateMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const handleSendFree = async (body: string) => {
    try {
      return await sendMessage.mutateAsync({ body });
    } catch (err) {
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        setForceTemplateMode(true);
      }
      return undefined;
    }
  };

  const handleSendTemplate = async (
    template_sid: string,
    template_variables: Record<string, string>,
  ) => {
    try {
      const res = await sendMessage.mutateAsync({ template_sid, template_variables });
      setForceTemplateMode(false);
      return res;
    } catch {
      return undefined;
    }
  };

  return (
    <ConversationThread
      conversation={conversation}
      messages={messages}
      onStatusChange={(status) =>
        updateConversation.mutate({ id: conversation.id, patch: { status } })
      }
    >
      <MessageComposer
        conversation={conversation}
        sending={sendMessage.isPending}
        forceTemplateMode={forceTemplateMode}
        onSendFree={handleSendFree}
        onSendTemplate={handleSendTemplate}
      />
    </ConversationThread>
  );
}