import { useIsMobile } from '@/hooks/use-mobile';
import { useConversations } from '@/hooks/useConversations';
import { ConversationsList } from '@/components/conversations/ConversationsList';
import { ConversationDetail } from '@/components/conversations/ConversationDetail';
import { LeadInfoPanel } from '@/components/conversations/LeadInfoPanel';
import { cn } from '@/lib/utils';

export default function Atendimentos() {
  const isMobile = useIsMobile();
  const { selectedConversationId, getSelectedConversation } = useConversations();
  const selectedConversation = getSelectedConversation();

  // Mobile: show list, then conversation, then info
  if (isMobile) {
    if (!selectedConversationId) {
      return (
        <div className="h-[calc(100vh-180px)] bg-card rounded-lg border overflow-hidden">
          <ConversationsList />
        </div>
      );
    }
    
    return (
      <div className="h-[calc(100vh-180px)] bg-card rounded-lg border overflow-hidden">
        <ConversationDetail showBackButton />
      </div>
    );
  }

  // Desktop: 3-column layout
  return (
    <div className="h-[calc(100vh-180px)] flex gap-4">
      {/* Left column - Conversations list */}
      <div className="w-[320px] flex-shrink-0 bg-card rounded-lg border overflow-hidden">
        <ConversationsList />
      </div>
      
      {/* Center column - Conversation detail */}
      <div className="flex-1 min-w-0 bg-card rounded-lg border overflow-hidden">
        <ConversationDetail />
      </div>
      
      {/* Right column - Lead info panel */}
      <div className={cn(
        "w-[380px] flex-shrink-0 bg-card rounded-lg border overflow-hidden transition-opacity",
        !selectedConversation && "opacity-50"
      )}>
        <LeadInfoPanel 
          dealId={selectedConversation?.dealId || null}
          contactId={selectedConversation?.contactId || null}
        />
      </div>
    </div>
  );
}
