import { useMemo } from 'react';
import { useConversationsContext } from '@/contexts/ConversationsContext';

export function useConversations() {
  const context = useConversationsContext();

  const filteredConversations = useMemo(() => {
    let result = context.conversations;

    // Filter by search query
    if (context.searchQuery) {
      const query = context.searchQuery.toLowerCase();
      result = result.filter(c => 
        c.contactName.toLowerCase().includes(query) ||
        c.contactEmail?.toLowerCase().includes(query) ||
        c.contactPhone?.includes(query)
      );
    }

    // Filter by channel
    if (context.channelFilter !== 'all') {
      result = result.filter(c => c.channel === context.channelFilter);
    }

    // Filter by owner
    if (context.ownerFilter !== 'all') {
      result = result.filter(c => c.ownerId === context.ownerFilter);
    }

    // Sort by lastMessageAt (most recent first)
    result = [...result].sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return result;
  }, [context.conversations, context.searchQuery, context.channelFilter, context.ownerFilter]);

  return {
    ...context,
    filteredConversations,
  };
}
