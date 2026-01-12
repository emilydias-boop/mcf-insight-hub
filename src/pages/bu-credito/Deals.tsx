import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreditProducts, useCreditDeals, useCreditStages, useUpdateCreditDeal } from '@/hooks/useCreditoData';
import { formatCurrency } from '@/lib/formatters';
import { Plus, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import type { CreditDeal } from '@/types/credito';

export default function CreditoDeals() {
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  
  const { data: products, isLoading: loadingProducts } = useCreditProducts();
  const { data: deals, isLoading: loadingDeals } = useCreditDeals(
    selectedProduct !== 'all' ? selectedProduct : undefined
  );
  const { data: stages, isLoading: loadingStages } = useCreditStages(
    selectedProduct !== 'all' ? selectedProduct : undefined
  );
  const updateDeal = useUpdateCreditDeal();

  const isLoading = loadingProducts || loadingDeals || loadingStages;

  // Group deals by stage
  const dealsByStage = deals?.reduce((acc, deal) => {
    const stageId = deal.stage_id;
    if (!acc[stageId]) acc[stageId] = [];
    acc[stageId].push(deal);
    return acc;
  }, {} as Record<string, CreditDeal[]>);

  // Get unique stages when viewing all products
  const displayStages = selectedProduct !== 'all' 
    ? stages 
    : stages?.filter((stage, index, self) => 
        index === self.findIndex(s => s.name === stage.name)
      );

  const handleMoveDeal = async (dealId: string, newStageId: string) => {
    try {
      await updateDeal.mutateAsync({ id: dealId, stage_id: newStageId });
      toast({ title: 'Deal movido com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao mover deal', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Negócios de Crédito</h1>
          <p className="text-muted-foreground mt-1">Kanban de todos os deals</p>
        </div>
        
        <div className="flex gap-3">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecionar produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Produtos</SelectItem>
              {products?.map(product => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Deal
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-[500px] min-w-[300px]" />
          ))}
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {displayStages?.map(stage => {
              // Get deals for this stage (by stage_id or by stage name if viewing all)
              const stageDeals = selectedProduct !== 'all'
                ? dealsByStage?.[stage.id] || []
                : deals?.filter(d => d.stage?.name === stage.name) || [];
              
              const totalValue = stageDeals.reduce((sum, d) => sum + (d.valor_solicitado || 0), 0);

              return (
                <div 
                  key={stage.id} 
                  className="min-w-[300px] max-w-[300px] flex flex-col"
                >
                  <div 
                    className="p-3 rounded-t-lg flex items-center justify-between"
                    style={{ backgroundColor: stage.color + '20', borderTop: `3px solid ${stage.color}` }}
                  >
                    <div>
                      <h3 className="font-semibold text-sm">{stage.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {stageDeals.length} deals • {formatCurrency(totalValue)}
                      </p>
                    </div>
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                  </div>
                  
                  <div className="flex-1 bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[400px]">
                    {stageDeals.map(deal => (
                      <Card 
                        key={deal.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{deal.titulo}</h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {deal.client?.full_name || 'Sem cliente'}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-sm font-bold text-primary">
                                  {formatCurrency(deal.valor_solicitado)}
                                </span>
                                {selectedProduct === 'all' && deal.product && (
                                  <Badge variant="outline" className="text-xs">
                                    {deal.product.code}
                                  </Badge>
                                )}
                              </div>
                              {deal.partner && (
                                <Badge variant="secondary" className="text-xs mt-2">
                                  Sócio: {deal.partner.full_name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {stageDeals.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                        Nenhum deal
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
