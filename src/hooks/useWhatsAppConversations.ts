import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WhatsAppConversation {
  id: string;
  instance_id: string | null;
  remote_jid: string;
  contact_id: string | null;
  deal_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  is_group?: boolean;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  message_id_whatsapp: string | null;
  content: string;
  direction: string;
  status: string;
  sender_id: string | null;
  sender_name: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  metadata: unknown;
  created_at: string;
}

export function useWhatsAppConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para enviar mensagens');
      return;
    }

    try {
      // Buscar full_name do profile do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const senderName = profile?.full_name || 'Atendente';

      // Optimistically add message
      const tempMessage: WhatsAppMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        message_id_whatsapp: null,
        content,
        direction: 'outbound',
        status: 'sending',
        sender_id: user.id,
        sender_name: senderName,
        sent_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        metadata: null,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, tempMessage]);

      // Send via edge function
      const { data, error } = await supabase.functions.invoke('zapi-send-message', {
        body: {
          conversationId,
          content,
          senderId: user.id,
          senderName,
        },
      });

      if (error) throw error;

      // Update with real message
      if (data?.message) {
        setMessages(prev => prev.map(m => 
          m.id === tempMessage.id ? data.message : m
        ));
      }

      // Update conversation last message
      setConversations(prev => prev.map(c => 
        c.id === conversationId 
          ? { ...c, last_message: content, last_message_at: new Date().toISOString(), unread_count: 0 }
          : c
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
    }
  }, [user]);

  // Mark as read
  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  // Select conversation
  const selectConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
    if (id) {
      fetchMessages(id);
      markAsRead(id);
    } else {
      setMessages([]);
    }
  }, [fetchMessages, markAsRead]);

  // Get messages for conversation
  const getMessagesForConversation = useCallback((conversationId: string) => {
    return messages.filter(m => m.conversation_id === conversationId);
  }, [messages]);

  // Get selected conversation
  const getSelectedConversation = useCallback(() => {
    if (!selectedConversationId) return null;
    return conversations.find(c => c.id === selectedConversationId) || null;
  }, [selectedConversationId, conversations]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => 
      c.contact_name?.toLowerCase().includes(query) ||
      c.contact_phone?.includes(query) ||
      c.last_message?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Unread count
  const unreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  }, [conversations]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for conversations
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        (payload) => {
          console.log('Conversation change:', payload);
          if (payload.eventType === 'INSERT') {
            setConversations(prev => [payload.new as WhatsAppConversation, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setConversations(prev => prev.map(c => 
              c.id === payload.new.id ? payload.new as WhatsAppConversation : c
            ));
          } else if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedConversationId) return;

    const channel = supabase
      .channel('whatsapp-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          console.log('New message:', payload);
          const newMessage = payload.new as WhatsAppMessage;
          // Avoid duplicates from optimistic updates
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id || m.message_id_whatsapp === newMessage.message_id_whatsapp)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          setMessages(prev => prev.map(m => 
            m.id === payload.new.id ? payload.new as WhatsAppMessage : m
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId]);

  return {
    conversations: filteredConversations,
    allConversations: conversations,
    messages,
    selectedConversationId,
    isLoading,
    unreadCount,
    searchQuery,
    setSearchQuery,
    selectConversation,
    sendMessage,
    markAsRead,
    getMessagesForConversation,
    getSelectedConversation,
    refetch: fetchConversations,
  };
}
