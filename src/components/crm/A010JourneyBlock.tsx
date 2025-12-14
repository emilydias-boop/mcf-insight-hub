import { useA010Journey } from '@/hooks/useA010Journey';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Calendar, DollarSign, TrendingUp, Clock, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface A010JourneyBlockProps {
  email?: string | null;
  phone?: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  hubla: 'Hubla',
  kiwify: 'Kiwify',
  make: 'Make',
  mixed: 'Múltiplas'
};

export const A010JourneyBlock = ({ email, phone }: A010JourneyBlockProps) => {
  const { data, isLoading } = useA010Journey(email, phone);
  
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }
  
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Jornada A010
        </h3>
        <div className="flex items-center gap-2">
          {data?.hasA010 && data.source && (
            <Badge variant="outline" className="text-xs">
              {SOURCE_LABELS[data.source] || data.source}
            </Badge>
          )}
          <Badge 
            variant={data?.hasA010 ? "default" : "secondary"}
            className={data?.hasA010 ? "bg-primary/20 text-primary border-0" : ""}
          >
            {data?.hasA010 ? '✓ Já comprou' : 'Nunca comprou'}
          </Badge>
        </div>
      </div>
      
      {data?.hasA010 ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Primeira compra: </span>
            <strong className="text-foreground">
              {data.firstPurchaseDate 
                ? format(new Date(data.firstPurchaseDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : 'Data não disponível'
              }
            </strong>
          </div>
          
          {data.lastPurchaseDate && data.purchaseCount > 1 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Última compra: </span>
              <strong className="text-foreground">
                {format(new Date(data.lastPurchaseDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </strong>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Total pago A010: </span>
            <strong className="text-primary">
              R$ {data.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Ticket médio: </span>
            <strong className="text-foreground">
              R$ {data.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Compras: </span>
            <strong className="text-foreground">{data.purchaseCount}</strong>
          </div>
          
          {data.products && data.products.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {data.products.slice(0, 3).map((product, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {product.length > 25 ? product.substring(0, 25) + '...' : product}
                </Badge>
              ))}
              {data.products.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{data.products.length - 3} mais
                </Badge>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Este lead ainda não possui compras A010 registradas.
        </p>
      )}
    </div>
  );
};
