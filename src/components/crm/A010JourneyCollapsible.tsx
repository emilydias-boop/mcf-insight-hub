import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ShoppingBag, CalendarDays, DollarSign, Hash } from 'lucide-react';
import { useA010Journey } from '@/hooks/useA010Journey';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

interface A010JourneyCollapsibleProps {
  email?: string | null;
  phone?: string | null;
}

export const A010JourneyCollapsible = ({ email, phone }: A010JourneyCollapsibleProps) => {
  const { data, isLoading } = useA010Journey(email, phone);
  const [isOpen, setIsOpen] = useState(false);
  
  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }
  
  if (!data) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Jornada A010 detalhada</span>
          <Badge 
            variant="outline" 
            className={`text-xs ${data.hasA010 ? 'border-primary/50 text-primary' : ''}`}
          >
            {data.hasA010 ? `${data.purchaseCount} compra${data.purchaseCount > 1 ? 's' : ''}` : 'Nunca comprou'}
          </Badge>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-2 p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
          {data.hasA010 ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Primeira compra:</span>
                <span className="font-medium text-foreground">
                  {data.firstPurchaseDate 
                    ? format(new Date(data.firstPurchaseDate), "dd/MM/yyyy", { locale: ptBR })
                    : '-'}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total pago:</span>
                <span className="font-bold text-primary">
                  R$ {data.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Quantidade:</span>
                <span className="font-medium text-foreground">
                  {data.purchaseCount} compra{data.purchaseCount > 1 ? 's' : ''}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Este contato ainda não realizou nenhuma compra A010.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
