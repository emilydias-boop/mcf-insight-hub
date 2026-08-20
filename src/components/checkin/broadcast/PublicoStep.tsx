import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Info, Loader2, Users } from 'lucide-react';
import {
  useWaEstagiosDisponiveis,
  useWaIgnoradosPorMotivo,
  useWaOrigensDisponiveis,
  useWaSendBudget,
  WaBroadcast,
  WaBroadcastBuDisponivel,
  WaBroadcastEscopo,
} from '@/hooks/wa/useWaBroadcasts';
import { formatMinutos, motivoLabel } from './waBroadcastLabels';
import { formatDateTime } from '@/lib/formatters';


interface Props {
  broadcast: WaBroadcast;
  stageId: string;
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
  onStageChange: (v: string) => void;
  onOriginChange: (v: string) => void;
  onLimiteChange: (v: string) => void;
  onMontar: () => void;
}

const HORAS_ALERTA = 6;

export function PublicoStep({
  broadcast,
  stageId,
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
  onStageChange,
  onOriginChange,
  onLimiteChange,
  onMontar,
}: Props) {
  const escopoBu = escopo === 'bu';
  const { data: origens = [], isLoading: origensLoading } = useWaOrigensDisponiveis();
  const { data: estagios = [], isLoading: estagiosLoading } = useWaEstagiosDisponiveis(
    originId || null,
  );
  const { data: budget } = useWaSendBudget();
  const { data: ignorados = {} } = useWaIgnoradosPorMotivo(broadcast.id);

  const ritmo = budget?.ritmo_por_minuto ?? 0;
  const tempo = ritmo > 0 ? pendentes / ritmo : 0;
  const totalIgnorados = Object.values(ignorados).reduce((a, b) => a + b, 0);
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n ?? 0);
  const semCarteira = !escopoBu && !origensLoading && origens.length === 0;

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
                {busDisponiveis.map((b) => (
                  <SelectItem key={b.bu} value={b.bu}>
                    {b.bu} — {fmt(b.sdrs)} SDRs, {fmt(b.leads)} leads
                  </SelectItem>
                ))}
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

      {escopoBu ? (
        <p className="text-sm text-muted-foreground">
          Os filtros de origem e estágio listam apenas a sua carteira, por isso ficam
          indisponíveis no escopo da BU. O público é a carteira inteira dos SDRs da BU.
        </p>
      ) : semCarteira ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium">Você não tem leads com telefone válido</p>
            <p className="text-xs text-muted-foreground">
              Não há origens com leads alcançáveis na sua carteira para filtrar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Origem (opcional)</Label>
            <Select value={originId || 'all'} onValueChange={(v) => onOriginChange(v === 'all' ? '' : v)}>
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
            <Label>Estágio (opcional)</Label>
            {!estagiosLoading && estagios.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você não tem leads com telefone válido
              </p>
            ) : (
              <Select value={stageId || 'all'} onValueChange={(v) => onStageChange(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os estágios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estágios</SelectItem>
                  {estagios.map((s) => (
                    <SelectItem key={s.stage_id} value={s.stage_id}>
                      {s.nome} ({fmt(s.leads)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
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
