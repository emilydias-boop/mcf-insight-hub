import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, TrendingDown, Package, Users, Trophy } from 'lucide-react';
import { useProductsBySetor, usePerformanceByPerson, getPeriodFilter, useSetoresSummary } from '@/hooks/useProductsMaster';
import { SETORES_CONFIG } from '@/types/produtos';
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

export default function InsidePage() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'month' | 'lastMonth' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  
  const period = getPeriodFilter(periodType, customStart, customEnd);
  const { data: setores } = useSetoresSummary(period);
  const { data: products, isLoading: productsLoading } = useProductsBySetor('inside', period);
  const { data: performance, isLoading: perfLoading } = usePerformanceByPerson('inside', period);
  
  const setorData = setores?.find(s => s.setor === 'inside');
  const config = SETORES_CONFIG.inside;
  
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
      
      {/* Tabs */}
      <Tabs defaultValue="produtos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="produtos">Por Produto</TabsTrigger>
          <TabsTrigger value="pessoas">Por Pessoa</TabsTrigger>
        </TabsList>
        
        <TabsContent value="produtos">
          <Card>
            <CardHeader>
              <CardTitle>Produtos do Setor Inside</CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
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
        </TabsContent>
        
        <TabsContent value="pessoas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {perfLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : performance?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado de performance encontrado para o período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance?.map((person, index) => (
                      <TableRow key={person.id}>
                        <TableCell>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {person.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {person.role.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(person.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {person.quantidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {person.variacao >= 0 ? (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              +{person.variacao.toFixed(1)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              {person.variacao.toFixed(1)}%
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
