import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  usePresencaConfig, usePresencaLista, useCapacidadeDia, usePresencaMutations,
} from '@/hooks/usePresencaDia';
import { hojeSP, ROTULO_BU, type PessoaPresenca, type PresencaBU } from '@/lib/presencaDia';

function Linha({ p, onCorrigir, salvando }: {
  p: PessoaPresenca; salvando: boolean;
  onCorrigir: (presente: boolean, motivo: string) => void;
}) {
  const [editando, setEditando] = useState<boolean | null>(null);
  const [motivo, setMotivo] = useState('');
  return (
    <div className={cn('rounded-lg border p-3 space-y-2', !p.conta && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{p.nome}</span>
        {p.tipo === 'sdr' && p.meta != null && <span className="text-xs text-muted-foreground">meta {p.meta}</span>}
        {!p.conta && <Badge variant="outline" className="text-[10px]">fora da conta</Badge>}
        <span className="text-xs text-muted-foreground">
          {p.primeiro_acesso ? `acessou às ${p.primeiro_acesso}` : 'sem acesso até o corte'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={p.presente ? 'default' : 'secondary'}>{p.presente ? 'Presente' : 'Ausente'}</Badge>
          {p.origem === 'corrigido_lider' && <span className="text-[11px] text-muted-foreground">corrigido: {p.motivo}</span>}
          <Button size="sm" variant="outline" onClick={() => setEditando(true)}><UserCheck className="h-3.5 w-3.5 mr-1" />Presente</Button>
          <Button size="sm" variant="outline" onClick={() => setEditando(false)}><UserX className="h-3.5 w-3.5 mr-1" />Ausente</Button>
        </div>
      </div>
      {editando !== null && (
        <div className="flex gap-2">
          <Input autoFocus placeholder={`Motivo para marcar ${editando ? 'presente' : 'ausente'}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="sm" disabled={!motivo.trim() || salvando || !p.profile_id}
            onClick={() => { onCorrigir(editando, motivo); setEditando(null); setMotivo(''); }}>Salvar</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
        </div>
      )}
    </div>
  );
}

export default function PresencaDoDia() {
  const data = hojeSP();
  const { data: configs, isLoading } = usePresencaConfig();
  const [bu, setBu] = useState<PresencaBU | null>(null);
  useEffect(() => { if (!bu && configs?.length) setBu(configs[0].bu); }, [configs, bu]);

  const { data: lista, isLoading: lLista } = usePresencaLista(data, bu);
  const { data: cap } = useCapacidadeDia(data, bu);
  const { corrigir, confirmar } = usePresencaMutations(data, bu);

  const closers = useMemo(() => (lista ?? []).filter((p) => p.tipo === 'closer'), [lista]);
  const sdrs = useMemo(() => (lista ?? []).filter((p) => p.tipo === 'sdr'), [lista]);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!configs?.length) return <div className="p-6 text-muted-foreground">Esta tela é só para a líder da BU e administradores.</div>;

  const salvar = (p: PessoaPresenca) => (presente: boolean, motivo: string) =>
    corrigir.mutate({ tipo: p.tipo, profile_id: p.profile_id!, presente, motivo }, {
      onSuccess: () => toast.success('Presença corrigida'),
      onError: (e) => toast.error(e.message),
    });

  const confirmado = !!cap?.confirmacao;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Presença do dia</h1>
        <span className="text-sm text-muted-foreground">{data.split('-').reverse().join('/')}</span>
        {configs.length > 1 && (
          <Tabs value={bu ?? undefined} onValueChange={(v) => setBu(v as PresencaBU)} className="ml-auto">
            <TabsList>{configs.map((c) => <TabsTrigger key={c.bu} value={c.bu}>{ROTULO_BU[c.bu]}</TabsTrigger>)}</TabsList>
          </Tabs>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        A lista vem de quem acessou o sistema até as 11:00. Corrija quem estiver errado (com motivo) e confirme.
      </p>

      {cap && (
        <Card>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-sm">
            <div><div className="text-muted-foreground">Closers presentes</div><div className="text-xl font-bold">{(cap.closers_presentes ?? []).length}/{cap.closers_ativos}</div></div>
            <div><div className="text-muted-foreground">Reuniões / leads possíveis</div><div className="text-xl font-bold">{cap.reunioes_possiveis} / {cap.leads_possiveis}</div></div>
            <div><div className="text-muted-foreground">SDRs presentes</div><div className="text-xl font-bold">{(cap.sdrs_presentes ?? []).length}/{cap.sdrs_ativos}</div></div>
            <div><div className="text-muted-foreground">Agendamentos possíveis</div><div className="text-xl font-bold">{cap.agendamentos_possiveis}</div></div>
          </CardContent>
        </Card>
      )}

      {lLista ? <Skeleton className="h-40" /> : (
        <>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Closers R1</CardTitle></CardHeader>
            <CardContent className="space-y-2">{closers.map((p) => <Linha key={p.pessoa_id} p={p} salvando={corrigir.isPending} onCorrigir={salvar(p)} />)}
              {!closers.length && <p className="text-sm text-muted-foreground">Nenhum closer R1 ativo.</p>}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">SDRs</CardTitle></CardHeader>
            <CardContent className="space-y-2">{sdrs.map((p) => <Linha key={p.pessoa_id} p={p} salvando={corrigir.isPending} onCorrigir={salvar(p)} />)}
              {!sdrs.length && <p className="text-sm text-muted-foreground">Nenhum SDR ativo.</p>}</CardContent></Card>
        </>
      )}

      <div className="flex items-center gap-3">
        <Button disabled={confirmar.isPending} onClick={() => confirmar.mutate(undefined, {
          onSuccess: () => toast.success('Presença confirmada'), onError: (e) => toast.error(e.message),
        })}>
          <CheckCircle2 className="h-4 w-4 mr-1" />{confirmado ? 'Confirmar de novo' : 'Confirmar presença'}
        </Button>
        {confirmado && <span className="text-sm text-muted-foreground">Confirmado por {cap.confirmacao.por ?? '—'}</span>}
      </div>
    </div>
  );
}
