import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, TrendingDown, Home, Users, Trophy, Upload, FileSpreadsheet } from 'lucide-react';
import { usePerformanceByPerson, useConsorcioCards, getPeriodFilter, useSetoresSummary } from '@/hooks/useProductsMaster';
import { SETORES_CONFIG } from '@/types/produtos';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}MM`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
};

export default function ConsorcioPage() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'month' | 'lastMonth' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  
  const period = getPeriodFilter(periodType, customStart, customEnd);
  const { data: setores } = useSetoresSummary(period);
  const { data: cards, isLoading: cardsLoading } = useConsorcioCards(period);
  const { data: performance, isLoading: perfLoading } = usePerformanceByPerson('consorcio', period);
  
  const setorData = setores?.find(s => s.setor === 'consorcio');
  const config = SETORES_CONFIG.consorcio;
  
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
          <Button variant="outline" onClick={() => navigate('/produtos/consorcio/importar')}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Dados
          </Button>
          
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
                <p className="text-sm text-muted-foreground">Total Comissão</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(setorData?.total || 0)}
                </p>
              </div>
              <Home className="h-8 w-8 text-primary/50" />
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
                <p className="text-sm text-muted-foreground">Cartas Vendidas</p>
                <p className="text-2xl font-bold text-foreground">
                  {setorData?.quantidade || 0}
                </p>
              </div>
              <FileSpreadsheet className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comissão Média</p>
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
      <Tabs defaultValue="cartas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cartas">Cartas Vendidas</TabsTrigger>
          <TabsTrigger value="vendedores">Por Vendedor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="cartas">
          <Card>
            <CardHeader>
              <CardTitle>Cartas de Consórcio</CardTitle>
            </CardHeader>
            <CardContent>
              {cardsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : cards?.length === 0 ? (
                <div className="text-center py-12">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhuma carta de consórcio encontrada para o período.
                  </p>
                  <Button onClick={() => navigate('/produtos/consorcio/importar')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Dados
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Consorciado</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards?.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">
                          {card.consorciado}
                        </TableCell>
                        <TableCell>{card.contrato || '-'}</TableCell>
                        <TableCell>{card.parcela || '-'}</TableCell>
                        <TableCell>{card.vendedor_name || '-'}</TableCell>
                        <TableCell>
                          {card.data_interface 
                            ? format(new Date(card.data_interface), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(card.valor_comissao || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={card.status === 'pago' ? 'default' : 'secondary'}>
                            {card.status || 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="vendedores">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Vendedores
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
                  Nenhum dado de vendedores encontrado para o período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Cartas</TableHead>
                      <TableHead className="text-right">Comissão Média</TableHead>
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
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(person.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {person.quantidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(person.ticketMedio)}
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
