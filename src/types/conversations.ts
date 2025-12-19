export type ConversationChannel = 'whatsapp' | 'phone' | 'email';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageDirection = 'inbound' | 'outbound';

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sentAt: string;
  direction: MessageDirection;
  status: MessageStatus;
}

export interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAvatar: string | null;
  channel: ConversationChannel;
  origin: string;
  stage: string;
  lastMessage: string;
  lastMessageAt: string;
  isUnread: boolean;
  unreadCount: number;
  ownerId: string | null;
  ownerName: string | null;
  dealId: string | null;
}

export interface ConversationsState {
  isDrawerOpen: boolean;
  selectedConversationId: string | null;
  searchQuery: string;
  channelFilter: ConversationChannel | 'all';
  ownerFilter: string | 'all';
}

export interface ConversationsContextType extends ConversationsState {
  conversations: Conversation[];
  messages: Message[];
  unreadCount: number;
  isLoading: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  selectConversation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setChannelFilter: (channel: ConversationChannel | 'all') => void;
  setOwnerFilter: (owner: string | 'all') => void;
  markAsRead: (conversationId: string) => void;
  sendMessage: (conversationId: string, content: string) => void;
  getMessagesForConversation: (conversationId: string) => Message[];
  getSelectedConversation: () => Conversation | null;
}
