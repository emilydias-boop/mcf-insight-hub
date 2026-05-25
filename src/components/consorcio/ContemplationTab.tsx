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
import {
  calcularNumeroAplicado,
  recomendarLancesGrupo,
  getCorChanceLabel,
  type RecomendacaoCota,
  type ResultadoFallback,
} from '@/lib/contemplacao';
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
  const [resultados, setResultados] = useState<RecomendacaoCota[] | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<ResultadoFallback | null>(null);
  const [consultaAtiva, setConsultaAtiva] = useState(false);
  const [vagas, setVagas] = useState(2);

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

    // Calcular maior número de cota para fallback
    let maxCota = 0;
    for (const c of cards) {
      const n = parseInt(c.cota.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxCota) maxCota = n;
    }
    if (maxCota === 0) maxCota = 9999;

    const fallback = calcularNumeroAplicado(consultaNumero, maxCota);
    const recs = recomendarLancesGrupo(cards, fallback.numeroAplicado, vagas);
    setResultados(recs);
    setFallbackInfo(fallback);
    setConsultaAtiva(true);

    const cotasMatch = recs.filter((r) => r.distancia === 0).length;
    const cotasZona50 = recs.filter((r) => r.distancia > 0 && r.distancia <= 50).length;
    const cotasZona100 = recs.filter((r) => r.distancia > 50 && r.distancia <= 100).length;

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

  const canCalculate = !!(consultaGrupo && consultaPeriodo && consultaNumero.length >= 1);

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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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
                placeholder="01600"
                value={consultaNumero}
                onChange={(e) => setConsultaNumero(e.target.value.replace(/\D/g, ''))}
                maxLength={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Vagas por assembleia</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={vagas}
                onChange={(e) => setVagas(Math.max(1, Number(e.target.value) || 1))}
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
            Estimativa matemática baseada em distância do número sorteado + simulação de ranking com {vagas} vaga(s) por assembleia. Não substitui a apuração oficial da Embracon.
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
                Número digitado <strong>{consultaNumero}</strong> fora do range do grupo. Aplicado <strong>{fallbackInfo.numeroAplicado}</strong> por redução de dígitos. {fallbackInfo.motivoFallback}.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-emerald-600 text-white">
              Sorteio direto: {resultados.filter((r) => r.chanceLabel === 'Sorteio').length}
            </Badge>
            <Badge className="bg-blue-600 text-white">
              Lance 25% recomendado: {resultados.filter((r) => r.percentualRecomendado === 25).length}
            </Badge>
            <Badge className="bg-orange-500 text-white">
              Lance 50% recomendado: {resultados.filter((r) => r.percentualRecomendado === 50).length}
            </Badge>
            <Badge variant="outline">
              Não compensa: {resultados.filter((r) => r.percentualRecomendado === null).length}
            </Badge>
            <span className="text-sm font-medium ml-auto">
              Número aplicado: <strong>{fallbackInfo.numeroAplicado}</strong>
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
                    <TableHead className="text-center">Posição estimada</TableHead>
                    <TableHead>Chance</TableHead>
                    <TableHead>Lance recomendado</TableHead>
                    <TableHead className="text-right">Valor do lance</TableHead>
                  </>
                )}
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={consultaAtiva ? 13 : 9}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : consultaAtiva && displayCards ? (
                displayCards.length > 0 ? (
                  displayCards.map((rec) => {
                    const { card, distancia, chanceLabel, chancePercent, percentualRecomendado, valorLanceRecomendado, justificativa } = rec;
                    const posicaoFinal = percentualRecomendado === 50 ? rec.posicaoCom50 : percentualRecomendado === 25 ? rec.posicaoCom25 : rec.posicaoSemLance;
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
                        <TableCell className="text-center text-sm">
                          <span className="font-semibold">{posicaoFinal}º</span>
                          <span className="text-muted-foreground"> / {rec.vagas} vagas</span>
                          <div className="text-xs text-muted-foreground">dist. {distancia}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getCorChanceLabel(chanceLabel)} text-xs`}>
                            {chanceLabel} {chancePercent}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm" title={justificativa}>
                          {percentualRecomendado === null ? (
                            <span className="text-muted-foreground">Não compensa</span>
                          ) : percentualRecomendado === 0 ? (
                            <span className="text-emerald-600 font-medium">Sem lance</span>
                          ) : (
                            <span className="font-semibold">{percentualRecomendado}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {valorLanceRecomendado > 0
                            ? `R$ ${valorLanceRecomendado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
                            : '—'}
                        </TableCell>
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
                    <TableCell colSpan={13} className="text-center py-10 text-muted-foreground">
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
