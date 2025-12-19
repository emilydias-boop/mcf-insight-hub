import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Conversation, 
  Message, 
  ConversationsContextType, 
  ConversationChannel 
} from '@/types/conversations';
import { mockConversations, mockMessages } from '@/data/mockConversations';

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

const STORAGE_KEY = 'conversations_state';

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<ConversationChannel | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string | 'all'>('all');
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [isLoading] = useState(false);

  // Restore state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedConversationId) {
          setSelectedConversationId(parsed.selectedConversationId);
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }, []);

  // Save selected conversation to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedConversationId }));
    } catch (e) {
      // Ignore errors
    }
  }, [selectedConversationId]);

  const unreadCount = useMemo(() => {
    return conversations.filter(c => c.isUnread).length;
  }, [conversations]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen(prev => !prev), []);

  const selectConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
    if (id) {
      // Mark as read when selecting
      setConversations(prev => prev.map(c => 
        c.id === id ? { ...c, isUnread: false, unreadCount: 0 } : c
      ));
    }
  }, []);

  const markAsRead = useCallback((conversationId: string) => {
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, isUnread: false, unreadCount: 0 } : c
    ));
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      content,
      sentAt: new Date().toISOString(),
      direction: 'outbound',
      status: 'sending',
    };

    setMessages(prev => [...prev, newMessage]);

    // Update conversation last message
    setConversations(prev => prev.map(c => 
      c.id === conversationId 
        ? { ...c, lastMessage: content, lastMessageAt: newMessage.sentAt }
        : c
    ));

    // Simulate message being sent
    setTimeout(() => {
      setMessages(prev => prev.map(m => 
        m.id === newMessage.id ? { ...m, status: 'sent' } : m
      ));
    }, 500);

    // Simulate message being delivered
    setTimeout(() => {
      setMessages(prev => prev.map(m => 
        m.id === newMessage.id ? { ...m, status: 'delivered' } : m
      ));
    }, 1500);
  }, []);

  const getMessagesForConversation = useCallback((conversationId: string) => {
    return messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [messages]);

  const getSelectedConversation = useCallback(() => {
    if (!selectedConversationId) return null;
    return conversations.find(c => c.id === selectedConversationId) || null;
  }, [selectedConversationId, conversations]);

  const value: ConversationsContextType = {
    isDrawerOpen,
    selectedConversationId,
    searchQuery,
    channelFilter,
    ownerFilter,
    conversations,
    messages,
    unreadCount,
    isLoading,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    selectConversation,
    setSearchQuery,
    setChannelFilter,
    setOwnerFilter,
    markAsRead,
    sendMessage,
    getMessagesForConversation,
    getSelectedConversation,
  };

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversationsContext() {
  const context = useContext(ConversationsContext);
  if (context === undefined) {
    throw new Error('useConversationsContext must be used within a ConversationsProvider');
  }
  return context;
}
