import { Badge } from '@/components/ui/badge';
import { MapPin, Package, ShoppingBag } from 'lucide-react';
import { useA010Journey } from '@/hooks/useA010Journey';

interface SdrCompactHeaderProps {
  deal: any;
  contact: any;
}

export const SdrCompactHeader = ({ deal, contact }: SdrCompactHeaderProps) => {
  const { data: a010Data } = useA010Journey(contact?.email, contact?.phone);
  
  const customFields = deal?.custom_fields as Record<string, any> | null;
  const originName = deal?.crm_origins?.name || customFields?.origem || 'Não informada';
  const productName = deal?.product_name || customFields?.produto || customFields?.product_name || 'A010';
  
  // Formatar resumo A010
  const getA010Summary = () => {
    if (!a010Data) return null;
    if (!a010Data.hasA010) return 'Nunca comprou';
    return `${a010Data.purchaseCount} compra${a010Data.purchaseCount > 1 ? 's' : ''} • R$ ${a010Data.totalPaid.toLocaleString('pt-BR')}`;
  };
  
  return (
    <div className="bg-secondary/50 border-b border-border p-4 space-y-3">
      {/* Linha 1: Nome + Valor */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground truncate flex-1">
          {deal.name}
        </h2>
              <span className="text-lg font-bold text-primary whitespace-nowrap">
                R$ {((deal.value && deal.value > 0) ? deal.value : (a010Data?.totalPaid || 0)).toLocaleString('pt-BR')}
        </span>
      </div>
      
      {/* Linha 2: Badge do estágio */}
      {deal.crm_stages?.stage_name && (
        <Badge 
          className="bg-primary/20 text-primary border-0 font-medium"
          style={{ 
            backgroundColor: deal.crm_stages.color ? `${deal.crm_stages.color}20` : undefined,
            color: deal.crm_stages.color || undefined
          }}
        >
          {deal.crm_stages.stage_name}
        </Badge>
      )}
      
      {/* Linha 3: Chips de contexto (Origem, Produto, A010) */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs bg-background/50">
          <MapPin className="h-3 w-3 mr-1" />
          {originName}
        </Badge>
        <Badge variant="outline" className="text-xs bg-background/50">
          <Package className="h-3 w-3 mr-1" />
          {productName}
        </Badge>
        {a010Data && (
          <Badge 
            variant="outline" 
            className={`text-xs bg-background/50 ${a010Data.hasA010 ? 'border-primary/50 text-primary' : 'border-muted-foreground/30'}`}
          >
            <ShoppingBag className="h-3 w-3 mr-1" />
            A010: {getA010Summary()}
          </Badge>
        )}
      </div>
    </div>
  );
};
