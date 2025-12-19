import { Check, CheckCheck, Clock } from 'lucide-react';
import { Message } from '@/types/conversations';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
}

const statusIcons = {
  sending: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: Clock,
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const StatusIcon = statusIcons[message.status];

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch {
      return '';
    }
  };

  return (
    <div className={cn(
      "flex",
      isOutbound ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-2",
        isOutbound 
          ? "bg-primary text-primary-foreground rounded-br-md" 
          : "bg-muted text-foreground rounded-bl-md"
      )}>
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div className={cn(
          "flex items-center gap-1 mt-1",
          isOutbound ? "justify-end" : "justify-start"
        )}>
          <span className={cn(
            "text-xs",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatTime(message.sentAt)}
          </span>
          {isOutbound && StatusIcon && (
            <StatusIcon className={cn(
              "h-3.5 w-3.5",
              message.status === 'read' ? "text-blue-400" : "text-primary-foreground/70"
            )} />
          )}
        </div>
      </div>
    </div>
  );
}
