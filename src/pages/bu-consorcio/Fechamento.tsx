import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, RefreshCcw, Settings, Eye, Download, ChevronLeft, ChevronRight, Users, UserCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { ConsorcioStatusBadge } from '@/components/consorcio-fechamento/ConsorcioStatusBadge';
import { useConsorcioPayouts, useRecalculateConsorcioPayouts, useConsorcioClosers } from '@/hooks/useConsorcioFechamento';
import { useSdrPayouts } from '@/hooks/useSdrFechamento';
import { Badge } from '@/components/ui/badge';

export default function ConsorcioFechamento() {
  const navigate = useNavigate();
  const [anoMes, setAnoMes] = useState(format(new Date(), 'yyyy-MM'));
  
  // Closers data
  const { data: payouts, isLoading } = useConsorcioPayouts(anoMes);
  const { data: closers } = useConsorcioClosers();
  const recalculate = useRecalculateConsorcioPayouts();

  // SDRs data - filtered by squad 'consorcio'
  const { data: sdrPayouts, isLoading: sdrLoading } = useSdrPayouts(anoMes, {
    squad: 'consorcio',
    roleType: 'sdr',
  });

  // Gerar opções de meses (últimos 12 meses)
  const mesesOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

  const handleRecalculate = () => {
    recalculate.mutate(anoMes);
  };

  const handleMesAnterior = () => {
    const [ano, mes] = anoMes.split('-').map(Number);
    const novaData = new Date(ano, mes - 2, 1);
    setAnoMes(format(novaData, 'yyyy-MM'));
  };

  const handleProximoMes = () => {
    const [ano, mes] = anoMes.split('-').map(Number);
    const novaData = new Date(ano, mes, 1);
    setAnoMes(format(novaData, 'yyyy-MM'));
  };

  // Totais Closers
  const totaisClosers = (payouts || []).reduce(
    (acc, p) => ({
      fixo: acc.fixo + (p.fixo_valor || 0),
      variavel: acc.variavel + (p.valor_variavel_final || 0),
      total: acc.total + (p.total_conta || 0),
    }),
    { fixo: 0, variavel: 0, total: 0 }
  );

  // Totais SDRs
  const totaisSdrs = (sdrPayouts || []).reduce(
    (acc, p) => ({
      fixo: acc.fixo + (p.valor_fixo || 0),
      variavel: acc.variavel + (p.valor_variavel_total || 0),
      total: acc.total + (p.total_conta || 0),
      ifood: acc.ifood + (p.total_ifood || 0),
    }),
    { fixo: 0, variavel: 0, total: 0, ifood: 0 }
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fechamento - Consórcio</h1>
            <p className="text-muted-foreground">
              Gestão de fechamento e comissões da equipe de consórcio
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleMesAnterior}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Select value={anoMes} onValueChange={setAnoMes}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesesOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={handleProximoMes}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={handleRecalculate} disabled={recalculate.isPending}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${recalculate.isPending ? 'animate-spin' : ''}`} />
          {recalculate.isPending ? 'Processando...' : 'Recalcular Todos'}
        </Button>
        
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => navigate('/consorcio/fechamento/configuracoes')}
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
      </div>

      {/* Tabs: Closers vs SDRs */}
      <Tabs defaultValue="closers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="closers" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Closers ({payouts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="sdrs" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            SDRs ({sdrPayouts?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Closers Tab */}
        <TabsContent value="closers" className="space-y-4">
          {/* Summary Cards - Closers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Fixo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-400">{formatCurrency(totaisClosers.fixo)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Variável</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(totaisClosers.variavel)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Conta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totaisClosers.total)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Closers Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Fixo</TableHead>
                    <TableHead className="text-right">Variável</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : !payouts || payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum fechamento encontrado. Clique em "Recalcular Todos" para gerar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {payout.closer?.color && (
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: payout.closer.color }}
                              />
                            )}
                            {payout.closer?.name || 'Closer não encontrado'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ConsorcioStatusBadge status={payout.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(payout.fixo_valor || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(payout.valor_variavel_final || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(payout.total_conta || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/consorcio/fechamento/${payout.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SDRs Tab */}
        <TabsContent value="sdrs" className="space-y-4">
          {/* Summary Cards - SDRs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Fixo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-400">{formatCurrency(totaisSdrs.fixo)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Variável</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(totaisSdrs.variavel)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Conta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totaisSdrs.total)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total iFood</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-400">{formatCurrency(totaisSdrs.ifood)}</p>
              </CardContent>
            </Card>
          </div>

          {/* SDRs Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">% Meta</TableHead>
                    <TableHead className="text-right">Fixo</TableHead>
                    <TableHead className="text-right">Variável</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">iFood</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sdrLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : !sdrPayouts || sdrPayouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum SDR do Consórcio encontrado para este mês.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sdrPayouts.map((payout) => {
                      const employee = (payout as any).employee;
                      const pctMeta = (payout as any).pct_meta || 0;
                      
                      return (
                        <TableRow key={payout.id}>
                          <TableCell className="font-medium">
                            {payout.sdr?.name || 'SDR não encontrado'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {employee?.cargo_catalogo?.nome_exibicao || employee?.cargo || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                payout.status === 'APPROVED' 
                                  ? 'border-green-500 text-green-500' 
                                  : payout.status === 'LOCKED'
                                  ? 'border-red-500 text-red-500'
                                  : 'border-yellow-500 text-yellow-500'
                              }
                            >
                              {payout.status === 'APPROVED' ? 'Aprovado' : 
                               payout.status === 'LOCKED' ? 'Travado' : 'Rascunho'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={
                              pctMeta >= 100 ? 'text-green-500 font-medium' :
                              pctMeta >= 70 ? 'text-yellow-500' : 'text-red-500'
                            }>
                              {pctMeta.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(payout.valor_fixo || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(payout.valor_variavel_total || 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(payout.total_conta || 0)}
                          </TableCell>
                          <TableCell className="text-right text-orange-400">
                            {formatCurrency(payout.total_ifood || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/fechamento-sdr/${payout.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
