import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { ConversationsList } from './ConversationsList';
import { ConversationDetail } from './ConversationDetail';

export function ConversationsDrawer() {
  const { isDrawerOpen, closeDrawer, selectedConversationId } = useConversationsContext();

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Atendimentos</h2>
          <Button variant="ghost" size="icon" onClick={closeDrawer}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content - Two columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left column - Conversations list */}
          <div className="w-full sm:w-1/3 border-r border-border flex flex-col overflow-hidden">
            <ConversationsList />
          </div>

          {/* Right column - Conversation detail */}
          <div className="hidden sm:flex sm:w-2/3 flex-col overflow-hidden">
            <ConversationDetail />
          </div>
        </div>

        {/* Mobile: Show detail as overlay when conversation selected */}
        {selectedConversationId && (
          <div className="sm:hidden absolute inset-0 bg-background flex flex-col">
            <ConversationDetail showBackButton />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
