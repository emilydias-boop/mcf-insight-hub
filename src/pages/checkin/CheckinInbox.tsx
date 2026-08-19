import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWaConversations, useUpdateWaConversation, WaConversation, WaScope } from '@/hooks/wa/useWaConversations';
import { useWaMessages, WaSendError } from '@/hooks/wa/useWaMessages';
import { ConversationList } from '@/components/checkin/ConversationList';
import { ConversationThread } from '@/components/checkin/ConversationThread';
import { MessageComposer } from '@/components/checkin/MessageComposer';
import { ContactPanel } from '@/components/checkin/ContactPanel';
import { useNow } from '@/hooks/wa/useNow';

export default function CheckinInbox() {
  const { hasAnyRole } = useAuth();
  const canSeeAll = hasAnyRole('admin', 'manager');

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
    if (filtered.length === 0) return;
    if (!filtered.some((c) => c.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((c) => c.id === selectedId) ?? null;

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
  const { data: messages = [], sendMessage, sendMedia, markRead } = useWaMessages(conversation.id);
  const updateConversation = useUpdateWaConversation();
  const [forceTemplateMode, setForceTemplateMode] = useState(false);
  const now = useNow(60_000);

  useEffect(() => {
    markRead.mutate();
    setForceTemplateMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const handleSendFree = async (body: string): Promise<boolean> => {
    try {
      await sendMessage.mutateAsync({ body });
      return true;
    } catch (err) {
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        setForceTemplateMode(true);
      }
      return false;
    }
  };

  const handleSendTemplate = async (
    template_sid: string,
    template_variables: Record<string, string>,
  ): Promise<boolean> => {
    try {
      await sendMessage.mutateAsync({ template_sid, template_variables });
      setForceTemplateMode(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleSendMedia = async (input: {
    file: File | Blob;
    filename?: string;
    mediaType?: string;
    caption?: string;
    durationSeconds?: number;
  }): Promise<boolean> => {
    try {
      await sendMedia.mutateAsync(input);
      return true;
    } catch (err) {
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        setForceTemplateMode(true);
      }
      return false;
    }
  };

  return (
    <ConversationThread
      conversation={conversation}
      messages={messages}
      now={now}
      onStatusChange={(status) =>
        updateConversation.mutate({ id: conversation.id, patch: { status } })
      }
    >
      <MessageComposer
        conversation={conversation}
        now={now}
        sending={sendMessage.isPending || sendMedia.isPending}
        forceTemplateMode={forceTemplateMode}
        onSendFree={handleSendFree}
        onSendTemplate={handleSendTemplate}
        onSendMedia={handleSendMedia}
      />
    </ConversationThread>
  );
}