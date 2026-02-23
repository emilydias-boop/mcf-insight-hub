import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Search, Eye, Target, Dices, Calculator, AlertTriangle, Info } from 'lucide-react';
import { useContemplationCards, useGruposDisponiveis, useRegistrarConsultaLoteria } from '@/hooks/useContemplacao';
import { ConsorcioCard } from '@/types/consorcio';
import { classificarCotasPorLoteria, extrairNumeroBase, getCorZona, type CotaClassificada, type ResultadoFallback } from '@/lib/contemplacao';
import { VerificarSorteioModal } from './VerificarSorteioModal';
import { LanceModal } from './LanceModal';
import { ContemplationDetailsDrawer } from './ContemplationDetailsDrawer';

function getContemplationBadge(card: ConsorcioCard) {
  if (!card.motivo_contemplacao) {
    return <Badge variant="outline" className="text-xs">Não contemplada</Badge>;
  }
  if (card.motivo_contemplacao === 'sorteio') {
    return <Badge className="bg-green-600 text-xs">Sorteio</Badge>;
  }
  if (card.motivo_contemplacao === 'lance' || card.motivo_contemplacao === 'lance_fixo') {
    return <Badge className="bg-blue-600 text-xs">Lance</Badge>;
  }
  return <Badge className="bg-purple-600 text-xs">{card.motivo_contemplacao}</Badge>;
}

export function ContemplationTab() {
  // Consultation fields
  const [consultaGrupo, setConsultaGrupo] = useState('');
  const [consultaPeriodo, setConsultaPeriodo] = useState('');
  const [consultaNumero, setConsultaNumero] = useState('');
  const [resultados, setResultados] = useState<CotaClassificada[] | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<ResultadoFallback | null>(null);
  const [consultaAtiva, setConsultaAtiva] = useState(false);

  // Modal state
  const [selectedCard, setSelectedCard] = useState<ConsorcioCard | null>(null);
  const [sorteioOpen, setSorteioOpen] = useState(false);
  const [lanceOpen, setLanceOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: grupos = [] } = useGruposDisponiveis();
  const { data: cards, isLoading } = useContemplationCards({
    grupo: consultaGrupo || undefined,
  });
  const registrarConsulta = useRegistrarConsultaLoteria();

  const handleCalcular = () => {
    if (!consultaGrupo || !consultaPeriodo || !consultaNumero || !cards) return;

    const { classificados, fallback } = classificarCotasPorLoteria(consultaNumero, cards);
    setResultados(classificados);
    setFallbackInfo(fallback);
    setConsultaAtiva(true);

    const cotasMatch = classificados.filter(c => c.zona === 'match_sorteio').length;
    const cotasZona50 = classificados.filter(c => c.zona === 'zona_50').length;
    const cotasZona100 = classificados.filter(c => c.zona === 'zona_100').length;

    registrarConsulta.mutate({
      grupo: consultaGrupo,
      periodo: consultaPeriodo,
      numeroLoteria: consultaNumero,
      numeroBase: fallback.numeroBase,
      numeroAplicado: String(fallback.numeroAplicado),
      cotasMatch,
      cotasZona50,
      cotasZona100,
    });
  };

  const handleLimpar = () => {
    setResultados(null);
    setFallbackInfo(null);
    setConsultaAtiva(false);
  };

  const displayCards = useMemo(() => {
    if (consultaAtiva && resultados) {
      return resultados;
    }
    return null;
  }, [consultaAtiva, resultados]);

  const openSorteio = (card: ConsorcioCard) => { setSelectedCard(card); setSorteioOpen(true); };
  const openLance = (card: ConsorcioCard) => { setSelectedCard(card); setLanceOpen(true); };
  const openDetails = (card: ConsorcioCard) => { setSelectedCard(card); setDetailsOpen(true); };

  const canCalculate = consultaGrupo && consultaPeriodo && consultaNumero.length >= 5;

  return (
    <div className="space-y-4">
      {/* Consultation section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Consulta por Sorteio da Loteria Federal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Grupo *</Label>
              <Select value={consultaGrupo} onValueChange={setConsultaGrupo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o grupo" />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assembleia / Período *</Label>
              <Input
                placeholder="MM/AAAA"
                value={consultaPeriodo}
                onChange={(e) => setConsultaPeriodo(e.target.value)}
                maxLength={7}
              />
            </div>

            <div className="space-y-2">
              <Label>Número da Loteria Federal *</Label>
              <Input
                placeholder="012345"
                value={consultaNumero}
                onChange={(e) => setConsultaNumero(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCalcular}
                disabled={!canCalculate || isLoading}
                className="flex-1"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calcular possibilidades
              </Button>
              {consultaAtiva && (
                <Button variant="outline" onClick={handleLimpar}>
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal disclaimer */}
      {consultaAtiva && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta é uma previsão baseada no número da Loteria Federal e proximidade das cotas. A contemplação real depende da assembleia da Embracon e dos lances realizados.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary badges */}
      {consultaAtiva && resultados && fallbackInfo && (
        <>
          {fallbackInfo.fallbackAplicado && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                O número base <strong>{fallbackInfo.numeroBase}</strong> está fora do range do grupo. {fallbackInfo.motivoFallback}.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-emerald-600 text-white">
              Match Sorteio: {resultados.filter(r => r.zona === 'match_sorteio').length}
            </Badge>
            <Badge className="bg-blue-600 text-white">
              Zona ±50: {resultados.filter(r => r.zona === 'zona_50').length}
            </Badge>
            <Badge className="bg-yellow-500 text-white">
              Zona ±100: {resultados.filter(r => r.zona === 'zona_100').length}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Número base (5 dígitos): {fallbackInfo.numeroBase}
            </span>
            <span className="text-sm font-medium">
              Número aplicado: {fallbackInfo.numeroAplicado}
            </span>
          </div>
        </>
      )}

      {/* Results table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>CPF / CNPJ</TableHead>
                <TableHead className="text-center">Grupo</TableHead>
                <TableHead className="text-center">Cota</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status Cota</TableHead>
                <TableHead>Contemplação</TableHead>
                {consultaAtiva && (
                  <>
                    <TableHead>Categoria de Chance</TableHead>
                    <TableHead>Recomendação de Lance</TableHead>
                  </>
                )}
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={consultaAtiva ? 11 : 9}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : consultaAtiva && displayCards ? (
                displayCards.length > 0 ? (
                  displayCards.map(({ card, zona, distancia, categoriaLabel, recomendacaoLance }) => {
                    const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
                    const doc = card.tipo_pessoa === 'pf' ? card.cpf : card.cnpj;
                    return (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">{displayName || '-'}</TableCell>
                        <TableCell className="text-xs font-mono">{doc || '-'}</TableCell>
                        <TableCell className="text-center">{card.grupo}</TableCell>
                        <TableCell className="text-center font-medium">{card.cota}</TableCell>
                        <TableCell className="text-right">
                          R$ {Number(card.valor_credito).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{card.tipo_produto}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{card.status}</Badge>
                        </TableCell>
                        <TableCell>{getContemplationBadge(card)}</TableCell>
                        <TableCell>
                          <Badge className={`${getCorZona(zona)} text-xs`}>
                            {categoriaLabel} ({distancia})
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{recomendacaoLance}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => openDetails(card)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Verificar sorteio" onClick={() => openSorteio(card)}>
                              <Dices className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Simular lance" onClick={() => openLance(card)}>
                              <Target className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      Nenhuma cota encontrada nas zonas de chance para este número
                    </TableCell>
                  </TableRow>
                )
              ) : !consultaAtiva && cards && cards.length > 0 ? (
                cards.map(card => {
                  const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
                  const doc = card.tipo_pessoa === 'pf' ? card.cpf : card.cnpj;
                  return (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{displayName || '-'}</TableCell>
                      <TableCell className="text-xs font-mono">{doc || '-'}</TableCell>
                      <TableCell className="text-center">{card.grupo}</TableCell>
                      <TableCell className="text-center font-medium">{card.cota}</TableCell>
                      <TableCell className="text-right">
                        R$ {Number(card.valor_credito).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{card.tipo_produto}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{card.status}</Badge>
                      </TableCell>
                      <TableCell>{getContemplationBadge(card)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => openDetails(card)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Verificar sorteio" onClick={() => openSorteio(card)}>
                            <Dices className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Simular lance" onClick={() => openLance(card)}>
                            <Target className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    {consultaGrupo ? 'Nenhuma cota encontrada' : 'Selecione um grupo para visualizar as cotas ou faça uma consulta por número da loteria'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <VerificarSorteioModal open={sorteioOpen} onOpenChange={setSorteioOpen} card={selectedCard} />
      <LanceModal open={lanceOpen} onOpenChange={setLanceOpen} card={selectedCard} />
      <ContemplationDetailsDrawer open={detailsOpen} onOpenChange={setDetailsOpen} card={selectedCard} />
    </div>
  );
}
