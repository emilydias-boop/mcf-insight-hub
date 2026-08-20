import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Users } from 'lucide-react';
import {
  useWaEstagiosDisponiveis,
  useWaIgnoradosPorMotivo,
  useWaOrigensDisponiveis,
  useWaSendBudget,
  WaBroadcast,
} from '@/hooks/wa/useWaBroadcasts';
import { formatMinutos, motivoLabel } from './waBroadcastLabels';


interface Props {
  broadcast: WaBroadcast;
  stageId: string;
  originId: string;
  limite: string;
  pendentes: number;
  montando: boolean;
  jaMontou: boolean;
  onStageChange: (v: string) => void;
  onOriginChange: (v: string) => void;
  onLimiteChange: (v: string) => void;
  onMontar: () => void;
}

export function PublicoStep({
  broadcast,
  stageId,
  originId,
  limite,
  pendentes,
  montando,
  jaMontou,
  onStageChange,
  onOriginChange,
  onLimiteChange,
  onMontar,
}: Props) {
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
  const semCarteira = !origensLoading && origens.length === 0;

  return (
    <div className="space-y-4">
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
        <Button type="button" onClick={onMontar} disabled={montando}>
          {montando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          Montar público
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