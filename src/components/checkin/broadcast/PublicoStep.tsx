import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Info, Loader2, Users, X } from 'lucide-react';
import {
  useWaEstagiosNoEscopo,
  useWaTagsNoEscopo,
  useWaIgnoradosPorMotivo,
  useWaOrigensDisponiveis,
  useWaSendBudget,
  WaBroadcast,
  WaBroadcastBuDisponivel,
  WaBroadcastEscopo,
  BU_VOLUME_MINIMO,
} from '@/hooks/wa/useWaBroadcasts';
import { MultiSelecaoPopover } from './MultiSelecaoPopover';
import { DONO_INATIVO_ALERTA_PCT, formatMinutos, motivoLabel } from './waBroadcastLabels';
import { formatDateTime } from '@/lib/formatters';



interface Props {
  broadcast: WaBroadcast;
  stageIds: string[];
  tags: string[];
  originId: string;
  limite: string;
  pendentes: number;
  montando: boolean;
  jaMontou: boolean;
  escopo: WaBroadcastEscopo;
  bu: string;
  busDisponiveis: WaBroadcastBuDisponivel[];
  podeUsarBu: boolean;
  /** quando o público em banco foi montado — só no rascunho reaberto */
  publicoMontadoEm?: string | null;
  onEscopoChange: (v: WaBroadcastEscopo) => void;
  onBuChange: (v: string) => void;
  onStageIdsChange: (v: string[]) => void;
  onTagsChange: (v: string[]) => void;
  onOriginChange: (v: string) => void;
  onLimiteChange: (v: string) => void;
  onMontar: () => void;
}

const HORAS_ALERTA = 6;

export function PublicoStep({
  broadcast,
  stageIds,
  tags,
  originId,
  limite,
  pendentes,
  montando,
  jaMontou,
  escopo,
  bu,
  busDisponiveis,
  podeUsarBu,
  publicoMontadoEm,
  onEscopoChange,
  onBuChange,
  onStageIdsChange,
  onTagsChange,
  onOriginChange,
  onLimiteChange,
  onMontar,
}: Props) {
  const escopoBu = escopo === 'bu';
  /** No escopo da BU as listas só existem depois de escolher a BU. */
  const filtrosBloqueados = escopoBu && !bu;
  const { data: origens = [], isLoading: origensLoading } = useWaOrigensDisponiveis();
  const { data: estagios = [], isLoading: estagiosLoading } = useWaEstagiosNoEscopo(
    escopo,
    bu || null,
    originId || null,
  );
  const { data: tagsDisponiveis = [], isLoading: tagsLoading } = useWaTagsNoEscopo(
    escopo,
    bu || null,
    originId || null,
  );
  const { data: budget } = useWaSendBudget();
  const { data: ignorados = {} } = useWaIgnoradosPorMotivo(broadcast.id);

  const ritmo = budget?.ritmo_por_minuto ?? 0;
  const tempo = ritmo > 0 ? pendentes / ritmo : 0;
  const totalIgnorados = Object.values(ignorados).reduce((a, b) => a + b, 0);
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n ?? 0);
  const semCarteira = !escopoBu && !origensLoading && origens.length === 0;

  const opcoesEstagios = useMemo(
    () => estagios.map((s) => ({ valor: s.stage_id, rotulo: s.nome, leads: s.leads })),
    [estagios],
  );
  const opcoesTags = useMemo(
    () => tagsDisponiveis.map((t) => ({ valor: t.tag, rotulo: t.tag, leads: t.leads })),
    [tagsDisponiveis],
  );



  const totalAlvos = pendentes + totalIgnorados;
  const donoInativo = ignorados.dono_inativo ?? 0;
  const pctDonoInativo = totalAlvos > 0 ? (donoInativo / totalAlvos) * 100 : 0;
  const alertaDonoInativo = donoInativo > 0 && pctDonoInativo >= DONO_INATIVO_ALERTA_PCT;

  const busGrandes = busDisponiveis.filter((b) => b.leads >= BU_VOLUME_MINIMO);
  const busPequenas = busDisponiveis.filter((b) => b.leads < BU_VOLUME_MINIMO);
  const buLabel = (b: WaBroadcastBuDisponivel) =>
    `${b.bu} — ${fmt(b.sdrs)} SDRs, ${fmt(b.leads)} leads` +
    (b.leads_sem_dono_ativo > 0 ? ` (${fmt(b.leads_sem_dono_ativo)} sem dono ativo)` : '');

  const idadeHoras = publicoMontadoEm
    ? (Date.now() - new Date(publicoMontadoEm).getTime()) / 3_600_000
    : null;
  const publicoVelho = idadeHoras !== null && idadeHoras > HORAS_ALERTA;
  const idadeTexto =
    idadeHoras === null
      ? null
      : idadeHoras < 1
        ? 'há menos de 1 hora'
        : idadeHoras < 48
          ? `há ${Math.round(idadeHoras)} hora(s)`
          : `há ${Math.round(idadeHoras / 24)} dia(s)`;

  return (
    <div className="space-y-4">
      {publicoMontadoEm && (
        <Alert variant={publicoVelho ? 'destructive' : 'default'}>
          {publicoVelho ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertDescription>
            Público montado {idadeTexto} ({formatDateTime(publicoMontadoEm)}).
            {publicoVelho
              ? ' A carteira pode ter mudado desde então — remonte para atualizar.'
              : ' Remonte se a carteira mudou.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>De onde vem o público</Label>
          <Select
            value={escopo}
            onValueChange={(v) => onEscopoChange(v as WaBroadcastEscopo)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minha_carteira">Minha carteira</SelectItem>
              {podeUsarBu && <SelectItem value="bu">Carteira da BU</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        {escopoBu && (
          <div className="space-y-2">
            <Label>BU</Label>
            <Select value={bu} onValueChange={onBuChange}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a BU" />
              </SelectTrigger>
              <SelectContent>
                {busGrandes.map((b) => (
                  <SelectItem key={b.bu} value={b.bu}>
                    {buLabel(b)}
                  </SelectItem>
                ))}
                {busPequenas.length > 0 && (
                  <>
                    <div className="mt-1 border-t px-2 pb-1 pt-2 text-xs text-muted-foreground">
                      Sem carteira relevante (menos de {BU_VOLUME_MINIMO} leads)
                    </div>
                    {busPequenas.map((b) => (
                      <SelectItem key={b.bu} value={b.bu} className="text-muted-foreground">
                        {buLabel(b)}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {escopoBu && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            A resposta de cada lead vai para a conversa do <strong>SDR dono dele</strong>, não
            para quem disparou. Um disparo, vários SDRs atendendo.
          </AlertDescription>
        </Alert>
      )}

      {semCarteira ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium">Você não tem leads com telefone válido</p>
            <p className="text-xs text-muted-foreground">
              Não há origens com leads alcançáveis na sua carteira para filtrar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Origem (opcional)</Label>
              <Select
                value={originId || 'all'}
                onValueChange={(v) => onOriginChange(v === 'all' ? '' : v)}
                disabled={filtrosBloqueados}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {origens.map((o) => (
                    <SelectItem key={o.origin_id} value={o.origin_id}>
                      {o.nome} ({fmt(o.leads)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estágios (opcional)</Label>
              <MultiSelecaoPopover
                rotuloBotao="Estágios"
                placeholderBusca="Buscar estágio..."
                opcoes={opcoesEstagios}
                selecionados={stageIds}
                onChange={onStageIdsChange}
                disabled={filtrosBloqueados}
                isLoading={estagiosLoading}
                vazioTexto="Nenhum estágio com leads alcançáveis"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (opcional)</Label>
              <MultiSelecaoPopover
                rotuloBotao="Tags"
                placeholderBusca="Buscar tag..."
                opcoes={opcoesTags}
                selecionados={tags}
                onChange={onTagsChange}
                disabled={filtrosBloqueados}
                isLoading={tagsLoading}
                vazioTexto="Nenhuma tag com leads alcançáveis"
              />
            </div>
          </div>

          {filtrosBloqueados && (
            <p className="text-sm text-muted-foreground">
              Escolha a BU primeiro para liberar os filtros de origem, estágio e tag.
            </p>
          )}

          {(stageIds.length > 0 || tags.length > 0) && (
            <div className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                {stageIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-xs uppercase text-muted-foreground">Estágios</span>
                    {stageIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {estagios.find((s) => s.stage_id === id)?.nome ?? id}
                        <button
                          type="button"
                          onClick={() => onStageIdsChange(stageIds.filter((s) => s !== id))}
                          aria-label="Remover estágio"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-xs uppercase text-muted-foreground">Tags</span>
                    {tags.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {t}
                        <button
                          type="button"
                          onClick={() => onTagsChange(tags.filter((x) => x !== t))}
                          aria-label="Remover tag"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <p className="max-w-xs text-xs text-muted-foreground">
                Entre estágios e entre tags a regra é <strong>OU</strong>; entre estágio e tag é{' '}
                <strong>E</strong>. O lead precisa estar em um dos estágios marcados{' '}
                <strong>e</strong> ter ao menos uma das tags marcadas.
              </p>
            </div>
          )}
        </div>
      )}



      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="limite-alvos">Limitar público (opcional)</Label>
          <Input
            id="limite-alvos"
            inputMode="numeric"
            className="w-40"
            value={limite}
            onChange={(e) => onLimiteChange(e.target.value.replace(/\D/g, ''))}
            placeholder="Sem limite"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => onLimiteChange('10')}>
          Testar com 10
        </Button>
        <Button type="button" onClick={onMontar} disabled={montando || (escopoBu && !bu)}>
          {montando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          {jaMontou || publicoMontadoEm ? 'Remontar público' : 'Montar público'}
        </Button>
      </div>

      {jaMontou && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs uppercase text-muted-foreground">Vão receber</p>
              <p className="text-2xl font-semibold">{pendentes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs uppercase text-muted-foreground">Ficam de fora</p>
              <p className="text-2xl font-semibold">{totalIgnorados}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs uppercase text-muted-foreground">Tempo estimado</p>
              <p className="text-2xl font-semibold">{formatMinutos(tempo)}</p>
              {ritmo > 0 && (
                <p className="text-xs text-muted-foreground">{ritmo} mensagens por minuto</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {jaMontou && alertaDonoInativo && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {fmt(donoInativo)} leads ({pctDonoInativo.toFixed(0)}% do público) estão com o dono
            bloqueado no sistema. Eles ficam de fora porque a resposta cairia numa conversa que
            ninguém lê — precisam de novo responsável antes de fazerem sentido num disparo.
          </AlertDescription>
        </Alert>
      )}

      {jaMontou && totalIgnorados > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="mb-2 text-sm font-medium">Por que ficam de fora</p>
            <ul className="space-y-1 text-sm">
              {Object.entries(ignorados)
                .sort((a, b) => b[1] - a[1])
                .map(([motivo, qtd]) => (
                  <li key={motivo} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{motivoLabel(motivo)}</span>
                    <span className="font-medium">{qtd}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
