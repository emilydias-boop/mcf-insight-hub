import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { cn } from '@/lib/utils';

export function ConversationsFloatingWidget() {
  const { toggleDrawer, unreadCount, isDrawerOpen } = useConversationsContext();

  return (
    <Button
      onClick={toggleDrawer}
      size="icon"
      className={cn(
        "fixed bottom-4 right-20 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-200",
        "bg-primary hover:bg-primary/90 text-primary-foreground",
        isDrawerOpen && "ring-2 ring-primary/50"
      )}
    >
      <MessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
