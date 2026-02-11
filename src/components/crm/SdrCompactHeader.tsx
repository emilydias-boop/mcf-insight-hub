import { Badge } from '@/components/ui/badge';
import { MapPin, Package, ShoppingBag, Tv, DollarSign } from 'lucide-react';
import { useA010Journey } from '@/hooks/useA010Journey';

interface SdrCompactHeaderProps {
  deal: any;
  contact: any;
}

export const SdrCompactHeader = ({ deal, contact }: SdrCompactHeaderProps) => {
  const { data: a010Data } = useA010Journey(contact?.email, contact?.phone);
  
  const customFields = deal?.custom_fields as Record<string, any> | null;
  const originName = deal?.crm_origins?.name || customFields?.origem || 'Não informada';
  const productName = deal?.product_name || customFields?.produto || customFields?.product_name || null;
  const estado = customFields?.estado || null;
  const faixaRenda = customFields?.faixa_de_renda || null;
  
  // Detect sales channel based on actual purchase data
  const isA010 = a010Data?.hasA010 === true;
  
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
      
      {/* Linha 3: Chips de contexto (Canal, Origem, Produto, Compras A010) */}
      <div className="flex flex-wrap gap-2">
        {/* Badge de Canal de Venda (A010 vs LIVE) - baseado em compra real */}
        <Badge 
          variant="outline" 
          className={`text-xs ${
            isA010 
              ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400' 
              : 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400'
          }`}
        >
          {isA010 ? (
            <><ShoppingBag className="h-3 w-3 mr-1" />A010</>
          ) : (
            <><Tv className="h-3 w-3 mr-1" />LIVE</>
          )}
        </Badge>
        
        {/* Detalhes de compras A010 (só se tiver comprado) */}
        {isA010 && a010Data && (
          <Badge variant="outline" className="text-xs border-primary/50 text-primary bg-primary/5">
            {a010Data.purchaseCount} compra{a010Data.purchaseCount > 1 ? 's' : ''} • R$ {a010Data.totalPaid.toLocaleString('pt-BR')}
          </Badge>
        )}
        
        <Badge variant="outline" className="text-xs bg-background/50">
          <MapPin className="h-3 w-3 mr-1" />
          {originName}
        </Badge>
        
        {productName && (
          <Badge variant="outline" className="text-xs bg-background/50">
            <Package className="h-3 w-3 mr-1" />
            {productName}
          </Badge>
        )}
        
        {estado && (
          <Badge variant="outline" className="text-xs bg-background/50">
            <MapPin className="h-3 w-3 mr-1" />
            {estado}
          </Badge>
        )}
        
        {faixaRenda && (
          <Badge variant="outline" className="text-xs bg-background/50">
            <DollarSign className="h-3 w-3 mr-1" />
            {faixaRenda}
          </Badge>
        )}
      </div>
    </div>
  );
};
