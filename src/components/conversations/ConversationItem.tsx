import { MessageCircle, Phone, Mail, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Conversation } from '@/types/conversations';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

const channelIcons = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
};

const channelColors = {
  whatsapp: 'text-green-500',
  phone: 'text-blue-500',
  email: 'text-orange-500',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

function formatTime(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: false, 
      locale: ptBR 
    });
  } catch {
    return '';
  }
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const ChannelIcon = channelIcons[conversation.channel];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-muted"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className={cn(
            "text-sm",
            conversation.isGroup ? "bg-emerald-500/20 text-emerald-600" : "bg-primary/10 text-primary"
          )}>
            {conversation.isGroup ? (
              <Users className="h-5 w-5" />
            ) : (
              getInitials(conversation.contactName)
            )}
          </AvatarFallback>
        </Avatar>
        {conversation.isUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "font-medium text-sm truncate",
            conversation.isUnread && "text-foreground",
            !conversation.isUnread && "text-muted-foreground"
          )}>
            {conversation.contactName}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <ChannelIcon className={cn("h-3 w-3 flex-shrink-0", channelColors[conversation.channel])} />
          <span className={cn(
            "text-xs truncate",
            conversation.isUnread ? "text-foreground" : "text-muted-foreground"
          )}>
            {conversation.lastMessage}
          </span>
        </div>
      </div>

      {/* Unread badge */}
      {conversation.unreadCount > 0 && (
        <span className="flex-shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white px-1.5">
          {conversation.unreadCount}
        </span>
      )}
    </button>
  );
}
