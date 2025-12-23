import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Conversation, 
  Message, 
  ConversationsContextType, 
  ConversationChannel 
} from '@/types/conversations';
import { useWhatsAppConversations, WhatsAppConversation, WhatsAppMessage } from '@/hooks/useWhatsAppConversations';
import { supabase } from '@/integrations/supabase/client';

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

const STORAGE_KEY = 'conversations_state';

// Transform WhatsApp conversation to generic Conversation type
function transformConversation(waConv: WhatsAppConversation): Conversation {
  return {
    id: waConv.id,
    contactId: waConv.contact_id || waConv.id,
    contactName: waConv.contact_name || 'Desconhecido',
    contactEmail: null,
    contactPhone: waConv.contact_phone,
    contactAvatar: waConv.contact_avatar,
    channel: 'whatsapp' as ConversationChannel,
    origin: 'WhatsApp',
    stage: 'Atendimento',
    lastMessage: waConv.last_message || '',
    lastMessageAt: waConv.last_message_at || waConv.created_at,
    isUnread: (waConv.unread_count || 0) > 0,
    unreadCount: waConv.unread_count || 0,
    ownerId: waConv.owner_id,
    ownerName: null,
    dealId: waConv.deal_id,
    isGroup: waConv.is_group || false,
  };
}

// Transform WhatsApp message to generic Message type
function transformMessage(waMsg: WhatsAppMessage): Message {
  // Extrair senderName do campo sender_name ou do metadata
  let senderName = waMsg.sender_name;
  if (!senderName && waMsg.metadata) {
    const metadata = waMsg.metadata as Record<string, unknown>;
    const raw = metadata?.raw as Record<string, unknown>;
    senderName = raw?.senderName as string || null;
  }

  return {
    id: waMsg.id,
    conversationId: waMsg.conversation_id,
    content: waMsg.content,
    sentAt: waMsg.sent_at,
    direction: waMsg.direction === 'inbound' ? 'inbound' : 'outbound',
    status: waMsg.status as Message['status'],
    senderName: senderName || undefined,
  };
}

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ConversationChannel | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string | 'all'>('all');

  const {
    conversations: waConversations,
    messages: waMessages,
    selectedConversationId,
    isLoading,
    unreadCount,
    searchQuery,
    setSearchQuery,
    selectConversation: waSelectConversation,
    sendMessage: waSendMessage,
    markAsRead: waMarkAsRead,
    getMessagesForConversation: waGetMessagesForConversation,
    getSelectedConversation: waGetSelectedConversation,
  } = useWhatsAppConversations();

  // Restore drawer state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedConversationId) {
          waSelectConversation(parsed.selectedConversationId);
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }, [waSelectConversation]);

  // Save selected conversation to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedConversationId }));
    } catch (e) {
      // Ignore errors
    }
  }, [selectedConversationId]);

  // Transform conversations
  const conversations = useMemo(() => {
    return waConversations.map(transformConversation);
  }, [waConversations]);

  // Transform messages
  const messages = useMemo(() => {
    return waMessages.map(transformMessage);
  }, [waMessages]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen(prev => !prev), []);

  const selectConversation = useCallback((id: string | null) => {
    waSelectConversation(id);
  }, [waSelectConversation]);

  const markAsRead = useCallback((conversationId: string) => {
    waMarkAsRead(conversationId);
  }, [waMarkAsRead]);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    waSendMessage(conversationId, content);
  }, [waSendMessage]);

  const getMessagesForConversation = useCallback((conversationId: string) => {
    const waMessages = waGetMessagesForConversation(conversationId);
    return waMessages.map(transformMessage);
  }, [waGetMessagesForConversation]);

  const getSelectedConversation = useCallback(() => {
    const waConv = waGetSelectedConversation();
    if (!waConv) return null;
    return transformConversation(waConv);
  }, [waGetSelectedConversation]);

  const findOrCreateConversationByPhone = useCallback(async (phone: string, contactName?: string): Promise<string> => {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // 1. Tentar encontrar conversa existente
    const { data: existing } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .ilike('contact_phone', `%${normalizedPhone.slice(-9)}%`)
      .maybeSingle();
    
    if (existing) {
      return existing.id;
    }
    
    // 2. Se não existir, criar nova conversa
    const remoteJid = normalizedPhone.startsWith('55') 
      ? `${normalizedPhone}@s.whatsapp.net`
      : `55${normalizedPhone}@s.whatsapp.net`;
    
    const { data: newConv, error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        remote_jid: remoteJid,
        contact_phone: normalizedPhone,
        contact_name: contactName || 'Novo Contato',
        unread_count: 0,
      })
      .select('id')
      .single();
    
    if (error) throw error;
    return newConv.id;
  }, []);

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
    findOrCreateConversationByPhone,
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
