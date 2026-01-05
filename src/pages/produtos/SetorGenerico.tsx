import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, TrendingDown, Package, Users, Trophy } from 'lucide-react';
import { useProductsBySetor, getPeriodFilter, useSetoresSummary } from '@/hooks/useProductsMaster';
import { SETORES_CONFIG, SetorType } from '@/types/produtos';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}MM`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
};

export default function SetorGenericoPage() {
  const navigate = useNavigate();
  const { setor } = useParams<{ setor: SetorType }>();
  const [periodType, setPeriodType] = useState<'month' | 'lastMonth' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  
  const setorId = setor as SetorType;
  const config = SETORES_CONFIG[setorId];
  
  if (!config) {
    navigate('/produtos');
    return null;
  }
  
  const period = getPeriodFilter(periodType, customStart, customEnd);
  const { data: setores } = useSetoresSummary(period);
  const { data: products, isLoading: productsLoading } = useProductsBySetor(setorId, period);
  
  const setorData = setores?.find(s => s.setor === setorId);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <span className="text-3xl">{config.icon}</span>
              {config.name}
            </h1>
            <p className="text-muted-foreground mt-1">{config.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês Atual</SelectItem>
              <SelectItem value="lastMonth">Mês Passado</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          
          {periodType === 'custom' && (
            <div className="flex gap-2">
              <DatePickerCustom
                selected={customStart}
                onSelect={(date) => setCustomStart(date as Date | undefined)}
                placeholder="Data inicial"
              />
              <DatePickerCustom
                selected={customEnd}
                onSelect={(date) => setCustomEnd(date as Date | undefined)}
                placeholder="Data final"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Faturado</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(setorData?.total || 0)}
                </p>
              </div>
              <Package className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Variação</p>
                <div className="flex items-center gap-2">
                  {(setorData?.variacao || 0) >= 0 ? (
                    <>
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <span className="text-2xl font-bold text-green-600">
                        +{(setorData?.variacao || 0).toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      <span className="text-2xl font-bold text-red-600">
                        {(setorData?.variacao || 0).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quantidade</p>
                <p className="text-2xl font-bold text-foreground">
                  {setorData?.quantidade || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(setorData?.ticketMedio || 0)}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos do Setor {config.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum produto encontrado para o período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => (
                  <TableRow key={product.category}>
                    <TableCell className="font-medium">
                      {product.categoryLabel}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(product.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.quantidade}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(product.ticketMedio)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.variacao >= 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +{product.variacao.toFixed(1)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-300">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          {product.variacao.toFixed(1)}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
