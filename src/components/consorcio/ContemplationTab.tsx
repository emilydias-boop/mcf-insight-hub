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
import { Eye, Target, Dices, Calculator, AlertTriangle, Info, Settings } from 'lucide-react';
import { useContemplationCards, useGruposDisponiveis, useRegistrarConsultaLoteria } from '@/hooks/useContemplacao';
import { ConsorcioCard } from '@/types/consorcio';
import {
  calcularNumeroAplicado,
  calcularRecomendacoesPorFaixa,
  getCorChanceFaixa,
  type RecomendacaoFaixa,
  type ResultadoFallback,
} from '@/lib/contemplacao';
import {
  useFaixasRecomendacao,
  useHistoricoAssembleiasGrupo,
  calcularVagasEstimadas,
  type CategoriaBem,
} from '@/hooks/useContemplacaoEngine';
import { VerificarSorteioModal } from './VerificarSorteioModal';
import { LanceModal } from './LanceModal';
import { ContemplationDetailsDrawer } from './ContemplationDetailsDrawer';
import { FaixasConfigDialog } from './FaixasConfigDialog';
import { HistoricoAssembleiaPanel } from './HistoricoAssembleiaPanel';

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
  const [categoria, setCategoria] = useState<CategoriaBem>('imovel');
  const [resultados, setResultados] = useState<RecomendacaoFaixa[] | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<ResultadoFallback | null>(null);
  const [consultaAtiva, setConsultaAtiva] = useState(false);
  const [faixasOpen, setFaixasOpen] = useState(false);

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
  const { data: faixas = [] } = useFaixasRecomendacao();
  const { data: historico = [] } = useHistoricoAssembleiasGrupo(consultaGrupo || null);
  const { vagas, media, baseAssembleias } = useMemo(
    () => calcularVagasEstimadas(historico, 2),
    [historico],
  );

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
    const recs = calcularRecomendacoesPorFaixa(cards, fallback.numeroAplicado, categoria, faixas, vagas);
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
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Consulta por Sorteio da Loteria Federal
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setFaixasOpen(true)}>
            <Settings className="h-4 w-4 mr-2" /> Faixas
          </Button>
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
              <Label>Categoria do bem *</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaBem)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="imovel">Imóvel</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
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

      {/* Histórico do grupo */}
      {consultaGrupo && (
        <HistoricoAssembleiaPanel grupo={consultaGrupo} vagasFallback={2} />
      )}

      {/* Legal disclaimer */}
      {consultaAtiva && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Estimativa baseada em: faixas do tipo "{categoria}" + {baseAssembleias > 0
              ? `média histórica de ${media.toFixed(2)} contemplados (${baseAssembleias} assembleias) → ${vagas} vaga(s) estimadas`
              : `${vagas} vaga(s) por padrão (sem histórico)`}. Não substitui a apuração oficial da Embracon.
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
              Sorteio: {resultados.filter((r) => r.chanceLabel === 'Sorteio').length}
            </Badge>
            <Badge className="bg-blue-600 text-white">
              Chance alta: {resultados.filter((r) => r.chanceLabel === 'Alta').length}
            </Badge>
            <Badge className="bg-yellow-500 text-white">
              Chance média: {resultados.filter((r) => r.chanceLabel === 'Média').length}
            </Badge>
            <Badge className="bg-orange-500 text-white">
              Chance baixa: {resultados.filter((r) => r.chanceLabel === 'Baixa').length}
            </Badge>
            <Badge variant="outline">
              Fora das faixas: {resultados.filter((r) => r.chanceLabel === 'Fora').length}
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
                    <TableHead className="text-center">Distância</TableHead>
                    <TableHead>Faixa aplicada</TableHead>
                    <TableHead className="text-center">Posição</TableHead>
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
                    <TableCell colSpan={consultaAtiva ? 15 : 9}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : consultaAtiva && displayCards ? (
                displayCards.length > 0 ? (
                  displayCards.map((rec) => {
                    const { card, distancia, chanceLabel, chancePercent, percentualSugerido, valorLance, justificativa, faixaAplicada, posicao } = rec;
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
                        <TableCell className="text-center text-sm font-semibold">{distancia}</TableCell>
                        <TableCell className="text-xs font-mono">{faixaAplicada}</TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="font-semibold">{posicao}º</span>
                          <span className="text-muted-foreground"> / {rec.vagas}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getCorChanceFaixa(chanceLabel)} text-xs`}>
                            {chanceLabel} {chancePercent}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm" title={justificativa}>
                          {percentualSugerido === null ? (
                            <span className="text-muted-foreground">Não compensa</span>
                          ) : percentualSugerido === 0 ? (
                            <span className="text-emerald-600 font-medium">Sem lance</span>
                          ) : (
                            <span className="font-semibold">{percentualSugerido}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {valorLance > 0
                            ? `R$ ${valorLance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
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
                    <TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                      Nenhuma cota encontrada nas zonas de chance para este número
                    </TableCell>
                  </TableRow>
                )
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    Preencha grupo, categoria, período e número da loteria e clique em "Calcular possibilidades" para listar as cotas dentro das zonas de chance.
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
      <FaixasConfigDialog open={faixasOpen} onOpenChange={setFaixasOpen} />
    </div>
  );
}
