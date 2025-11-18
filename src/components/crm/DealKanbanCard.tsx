import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, MessageCircle, Mail, Clock, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DealKanbanCardProps {
  deal: any;
  isDragging: boolean;
  provided: any;
  onClick?: () => void;
}

export const DealKanbanCard = ({ deal, isDragging, provided, onClick }: DealKanbanCardProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  const timeAgo = deal.updated_at
    ? formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true, locale: ptBR })
    : null;
  
  return (
    <Card
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {deal.tags && deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deal.tags.slice(0, 3).map((tag: any, idx: number) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs px-1.5 py-0"
                style={{ backgroundColor: tag.color || '#e5e7eb' }}
              >
                {typeof tag === 'string' ? tag : tag.name}
              </Badge>
            ))}
            {deal.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                +{deal.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
        
        <div className="font-medium text-sm line-clamp-2">{deal.name}</div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {deal.owner_name && (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary/10">
                  {getInitials(deal.owner_name)}
                </AvatarFallback>
              </Avatar>
            )}
            
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => e.stopPropagation()}
          >
            <Pin className={`h-3 w-3 ${deal.is_pinned ? 'fill-current' : ''}`} />
          </Button>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-emerald-600">
            {deal.value ? `R$ ${(deal.value / 1000).toFixed(1)}k` : 'R$ 0'}
          </span>
          
          {deal.activity_count !== undefined && (
            <span>{deal.completed_activities || 0}/{deal.activity_count}</span>
          )}
          
          {timeAgo && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
