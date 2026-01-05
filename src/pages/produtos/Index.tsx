import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useSetoresSummary, getPeriodFilter } from '@/hooks/useProductsMaster';
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

export default function ProdutosIndex() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'month' | 'lastMonth' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  
  const period = getPeriodFilter(periodType, customStart, customEnd);
  const { data: setores, isLoading } = useSetoresSummary(period);
  
  const handleSetorClick = (setor: SetorType) => {
    navigate(`/produtos/${setor}`);
  };
  
  const totalGeral = setores?.reduce((sum, s) => sum + s.total, 0) || 0;
  const totalAnterior = setores?.reduce((sum, s) => sum + s.totalAnterior, 0) || 0;
  const variacaoGeral = totalAnterior > 0 ? ((totalGeral - totalAnterior) / totalAnterior) * 100 : 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel de Produtos</h1>
          <p className="text-muted-foreground mt-1">
            Visão consolidada por setor
          </p>
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
      
      {/* Total Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Geral</p>
              <p className="text-4xl font-bold text-foreground">{formatCurrency(totalGeral)}</p>
            </div>
            <div className="flex items-center gap-2">
              {variacaoGeral >= 0 ? (
                <Badge variant="default" className="bg-green-500/20 text-green-600 hover:bg-green-500/30">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +{variacaoGeral.toFixed(1)}%
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-500/20 text-red-600 hover:bg-red-500/30">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  {variacaoGeral.toFixed(1)}%
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">vs período anterior</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Setores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-24 mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          setores?.map((setor) => {
            const config = SETORES_CONFIG[setor.setor];
            return (
              <Card 
                key={setor.setor}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group"
                onClick={() => handleSetorClick(setor.setor)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    {config.name}
                  </CardTitle>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Valor */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-bold text-foreground">
                        {formatCurrency(setor.total)}
                      </span>
                      {setor.variacao >= 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +{setor.variacao.toFixed(1)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-300">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          {setor.variacao.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    
                    {/* Detalhes */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Quantidade</p>
                        <p className="font-semibold text-foreground">{setor.quantidade}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ticket Médio</p>
                        <p className="font-semibold text-foreground">{formatCurrency(setor.ticketMedio)}</p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
