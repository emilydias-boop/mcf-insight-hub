import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ArrowRight, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SdrR2ConversionCardProps {
  aprovados: number;
  vendas: number;
  isLoading: boolean;
}

export function SdrR2ConversionCard({ aprovados, vendas, isLoading }: SdrR2ConversionCardProps) {
  const taxa = aprovados > 0 ? (vendas / aprovados) * 100 : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Minhas Conversões R2
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Minhas Conversões R2
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold">{aprovados}</p>
            <p className="text-xs text-muted-foreground">Aprovados</p>
          </div>
          
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-green-500">{vendas}</p>
            <p className="text-xs text-muted-foreground">Vendas</p>
          </div>
          
          <div className="text-center flex-1">
            <Badge 
              variant="secondary"
              className={taxa >= 50 ? 'bg-green-500/20 text-green-500' : ''}
            >
              {taxa.toFixed(0)}%
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Taxa</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
