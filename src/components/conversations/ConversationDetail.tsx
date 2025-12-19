import { ArrowLeft, ExternalLink, MessageCircle, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConversations } from '@/hooks/useConversations';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { cn } from '@/lib/utils';

interface ConversationDetailProps {
  showBackButton?: boolean;
}

const channelIcons = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
};

const channelLabels = {
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'Email',
};

export function ConversationDetail({ showBackButton = false }: ConversationDetailProps) {
  const { getSelectedConversation, getMessagesForConversation, selectConversation, sendMessage } = useConversations();
  
  const conversation = getSelectedConversation();
  
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          Selecione um contato na lista ao lado para ver as mensagens
        </p>
      </div>
    );
  }

  const messages = getMessagesForConversation(conversation.id);
  const ChannelIcon = channelIcons[conversation.channel];

  const handleSendMessage = (content: string) => {
    sendMessage(conversation.id, content);
  };

  const handleViewInCRM = () => {
    if (conversation.dealId) {
      window.open(`/crm/negocios?dealId=${conversation.dealId}`, '_blank');
    } else if (conversation.contactId) {
      window.open(`/crm/contatos?contactId=${conversation.contactId}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {showBackButton && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex-shrink-0"
            onClick={() => selectConversation(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{conversation.contactName}</h3>
            <ChannelIcon className={cn(
              "h-4 w-4 flex-shrink-0",
              conversation.channel === 'whatsapp' && "text-green-500",
              conversation.channel === 'phone' && "text-blue-500",
              conversation.channel === 'email' && "text-orange-500"
            )} />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {conversation.origin}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {conversation.stage}
            </Badge>
            {conversation.ownerName && (
              <span className="text-xs text-muted-foreground">
                • {conversation.ownerName}
              </span>
            )}
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="flex-shrink-0 gap-1.5"
          onClick={handleViewInCRM}
        >
          <ExternalLink className="h-4 w-4" />
          <span className="hidden lg:inline">Ver no CRM</span>
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">
              Nenhuma mensagem registrada ainda.
            </p>
            <p className="text-muted-foreground text-sm">
              Envie a primeira mensagem para iniciar o atendimento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Message input */}
      <MessageInput onSend={handleSendMessage} />
    </div>
  );
}
