import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreditProducts, useCreditDeals, useCreditKPIs, useCreditPartners } from '@/hooks/useCreditoData';
import { formatCurrency } from '@/lib/formatters';
import { Landmark, TrendingUp, Users, Briefcase, FileCheck, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function CreditoOverview() {
  const { data: products, isLoading: loadingProducts } = useCreditProducts();
  const { data: deals, isLoading: loadingDeals } = useCreditDeals();
  const { data: kpis, isLoading: loadingKpis } = useCreditKPIs();
  const { data: partners, isLoading: loadingPartners } = useCreditPartners();

  const isLoading = loadingProducts || loadingDeals || loadingKpis || loadingPartners;

  // Group deals by product
  const dealsByProduct = deals?.reduce((acc, deal) => {
    const productId = deal.product_id;
    if (!acc[productId]) acc[productId] = [];
    acc[productId].push(deal);
    return acc;
  }, {} as Record<string, typeof deals>);

  // Partner stats
  const activePartners = partners?.filter(p => p.status === 'ativo').length || 0;
  const totalAportado = partners?.reduce((sum, p) => sum + (p.valor_aportado || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">BU Crédito - Overview</h1>
        <p className="text-muted-foreground mt-1">Visão geral de todos os produtos de crédito</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Deals</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{kpis?.totalDeals || 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Solicitado</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(kpis?.totalSolicitado || 0)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <FileCheck className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Aprovado</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(kpis?.totalAprovado || 0)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Percent className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{kpis?.taxaConversao.toFixed(1)}%</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sócios / Parceiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sócios Ativos</span>
                  <span className="text-xl font-bold">{activePartners}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Aportado</span>
                  <span className="text-xl font-bold text-success">{formatCurrency(totalAportado)}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">
                    Capital Próprio: {partners?.filter(p => p.tipo === 'capital_proprio').length || 0}
                  </Badge>
                  <Badge variant="outline">
                    Carta Consórcio: {partners?.filter(p => p.tipo === 'carta_consorcio').length || 0}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Resultados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ganhos</span>
                  <span className="text-xl font-bold text-success">{kpis?.ganhos || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Perdidos</span>
                  <span className="text-xl font-bold text-destructive">{kpis?.perdidos || 0}</span>
                </div>
                <Progress 
                  value={kpis?.taxaConversao || 0} 
                  className="h-2"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos de Crédito</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products?.map(product => {
                const productDeals = dealsByProduct?.[product.id] || [];
                const totalValue = productDeals.reduce((sum, d) => sum + (d.valor_solicitado || 0), 0);
                
                return (
                  <Card key={product.id} className="bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-sm">{product.name}</h3>
                        <Badge variant="secondary">{productDeals.length}</Badge>
                      </div>
                      <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {product.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
