import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GRWalletEntry, GR_STATUS_LABELS } from '@/types/gr-types';
import { Phone, MessageCircle, Calendar, User, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GREntryCardProps {
  entry: GRWalletEntry;
  onClick?: () => void;
}

export const GREntryCard = ({ entry, onClick }: GREntryCardProps) => {
  const statusConfig = GR_STATUS_LABELS[entry.status];
  
  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.customer_phone) {
      const phone = entry.customer_phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };
  
  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.customer_phone) {
      window.open(`tel:${entry.customer_phone}`, '_blank');
    }
  };
  
  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            
            {/* Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{entry.customer_name}</h3>
                <Badge className={statusConfig.color} variant="outline">
                  {statusConfig.label}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <span>Entrada: {format(new Date(entry.entry_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                <span className="mx-2">•</span>
                <span>Origem: {entry.entry_source}</span>
              </div>
              
              {entry.product_purchased && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Produto: </span>
                  <span className="font-medium">{entry.product_purchased}</span>
                  {entry.purchase_value && (
                    <span className="text-muted-foreground"> - R$ {entry.purchase_value.toLocaleString('pt-BR')}</span>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                {entry.last_contact_at && (
                  <span>
                    Último contato: {formatDistanceToNow(new Date(entry.last_contact_at), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
                {entry.next_action_date && (
                  <span className="text-primary">
                    Próxima ação: {format(new Date(entry.next_action_date), "dd/MM", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleCall}
              disabled={!entry.customer_phone}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleWhatsApp}
              disabled={!entry.customer_phone}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
