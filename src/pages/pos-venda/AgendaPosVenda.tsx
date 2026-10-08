import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Video, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { POS_VENDA_ORIGIN_ID } from '@/lib/posVenda';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// Agenda própria do Pós Venda — separada de closers/meeting_slots para não afetar métricas de outras BUs.
const db = supabase as any;

type Reuniao = {
  id: string; deal_id: string; gerente_id: string; tipo: 'viabilidade_1' | 'viabilidade_2';
  inicio: string; duracao_min: number; link_reuniao: string | null; status: string; observacao: string | null;
  crm_deals?: { name: string | null } | null; profiles?: { full_name: string | null; email: string | null } | null;
};

const TIPO_LABEL = { viabilidade_1: 'Viabilidade 1', viabilidade_2: 'Viabilidade 2' } as const;
const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', no_show: 'No-show', cancelada: 'Cancelada' };

export default function AgendaPosVenda() {
  const qc = useQueryClient();
  const [semana, setSemana] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [novaAberta, setNovaAberta] = useState(false);
  const [selecionada, setSelecionada] = useState<Reuniao | null>(null);
  const fim = addDays(semana, 7);

  const { data: reunioes = [], isLoading } = useQuery({
    queryKey: ['pos-venda-reunioes', semana.toISOString()],
    queryFn: async () => {
      const { data, error } = await db.from('pos_venda_reunioes')
        .select('*, crm_deals(name), profiles:gerente_id(full_name, email)')
        .gte('inicio', semana.toISOString()).lt('inicio', fim.toISOString())
        .order('inicio');
      if (error) throw error;
      return data as Reuniao[];
    },
  });

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semana, i)), [semana]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Agenda de Reuniões — Viabilidade</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSemana(addDays(semana, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground min-w-[180px] text-center">
            {format(semana, "dd/MM", { locale: ptBR })} – {format(addDays(semana, 6), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setSemana(addDays(semana, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button onClick={() => setNovaAberta(true)}><Plus className="h-4 w-4 mr-1" />Nova reunião</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {dias.map((d) => {
            const doDia = reunioes.filter((r) => format(new Date(r.inicio), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'));
            return (
              <Card key={d.toISOString()} className="min-h-[160px]">
                <CardHeader className="p-2 pb-1">
                  <CardTitle className="text-xs font-medium capitalize">{format(d, "EEE dd/MM", { locale: ptBR })}</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-1">
                  {doDia.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  {doDia.map((r) => (
                    <button key={r.id} onClick={() => setSelecionada(r)}
                      className="w-full text-left rounded border border-border bg-muted/40 hover:bg-muted p-1.5 text-xs">
                      <div className="font-medium">{format(new Date(r.inicio), 'HH:mm')} · {TIPO_LABEL[r.tipo]}</div>
                      <div className="truncate">{r.crm_deals?.name ?? 'Cliente'}</div>
                      <div className="truncate text-muted-foreground">{r.profiles?.full_name}</div>
                      <Badge variant={r.status === 'agendada' ? 'secondary' : 'outline'} className="mt-1 text-[10px]">{STATUS_LABEL[r.status]}</Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {novaAberta && <NovaReuniaoDialog onClose={() => setNovaAberta(false)} onSalvo={() => qc.invalidateQueries({ queryKey: ['pos-venda-reunioes'] })} />}
      {selecionada && <ReuniaoDialog reuniao={selecionada} onClose={() => setSelecionada(null)} onSalvo={() => qc.invalidateQueries({ queryKey: ['pos-venda-reunioes'] })} />}
    </div>
  );
}

function useGerentes() {
  return useQuery({
    queryKey: ['pos-venda-gerentes'],
    queryFn: async () => {
      const { data: roles } = await db.from('user_roles').select('user_id, role').in('role', ['gerente_relacionamento', 'admin']);
      const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
      if (!ids.length) return [];
      const { data } = await db.from('profiles').select('id, full_name, email').in('id', ids).order('full_name');
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
}

function NovaReuniaoDialog({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const { user } = useAuth();
  const { data: gerentes = [] } = useGerentes();
  const [busca, setBusca] = useState('');
  const [dealId, setDealId] = useState('');
  const [gerenteId, setGerenteId] = useState(user?.id ?? '');
  const [tipo, setTipo] = useState<'viabilidade_1' | 'viabilidade_2'>('viabilidade_1');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState('10:00');
  const [duracao, setDuracao] = useState(60);
  const [link, setLink] = useState('');

  const { data: deals = [] } = useQuery({
    queryKey: ['pos-venda-deals-busca', busca],
    queryFn: async () => {
      let q = db.from('crm_deals').select('id, name').eq('origin_id', POS_VENDA_ORIGIN_ID).order('created_at', { ascending: false }).limit(30);
      if (busca.trim()) q = q.ilike('name', `%${busca.trim()}%`);
      const { data } = await q;
      return (data ?? []) as { id: string; name: string | null }[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const inicio = new Date(`${data}T${hora}:00`).toISOString();
      const { error } = await db.from('pos_venda_reunioes').insert({
        deal_id: dealId, gerente_id: gerenteId, tipo, inicio, duracao_min: duracao, link_reuniao: link || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Reunião agendada'); onSalvo(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao agendar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova reunião de viabilidade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente (pipeline Relacionamento - Pós venda)</Label>
            <Input placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
              <SelectContent>{deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.name ?? d.id}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Reunião</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viabilidade_1">Viabilidade 1</SelectItem>
                  <SelectItem value="viabilidade_2">Viabilidade 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gerente</Label>
              <Select value={gerenteId} onValueChange={setGerenteId}>
                <SelectTrigger><SelectValue placeholder="Gerente" /></SelectTrigger>
                <SelectContent>{gerentes.map((g) => <SelectItem key={g.id} value={g.id}>{g.full_name ?? g.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" min={10} max={480} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} /></div>
          </div>
          <div><Label>Link da reunião (opcional)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!dealId || !gerenteId || salvar.isPending} onClick={() => salvar.mutate()}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReuniaoDialog({ reuniao, onClose, onSalvo }: { reuniao: Reuniao; onClose: () => void; onSalvo: () => void }) {
  const [status, setStatus] = useState(reuniao.status);
  const [obs, setObs] = useState(reuniao.observacao ?? '');
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const { data: gravacoes = [], isLoading } = useQuery({
    queryKey: ['pos-venda-gravacoes', reuniao.id],
    queryFn: async () => {
      const { data, error } = await db.rpc('pos_venda_gravacoes_da_reuniao', { p_reuniao_id: reuniao.id });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string | null; started_at: string | null; duration_minutes: number | null; summary: any }[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('pos_venda_reunioes').update({ status, observacao: obs || null }).eq('id', reuniao.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Reunião atualizada'); onSalvo(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const assistir = async (recordingId: string) => {
    setAbrindo(recordingId);
    const { data, error } = await supabase.functions.invoke('pos-venda-gravacao', { body: { reuniao_id: reuniao.id, recording_id: recordingId } });
    setAbrindo(null);
    if (error || !data?.link) { toast.error(data?.mensagem ?? 'Não foi possível abrir a gravação'); return; }
    window.open(data.link, '_blank', 'noopener');
  };

  const resumo = (s: any) => typeof s === 'string' ? s : s?.summary ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{TIPO_LABEL[reuniao.tipo]} — {reuniao.crm_deals?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {format(new Date(reuniao.inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {reuniao.duracao_min} min · {reuniao.profiles?.full_name}
          </p>
          {reuniao.link_reuniao && (
            <a href={reuniao.link_reuniao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              <ExternalLink className="h-3 w-3" />Entrar na reunião
            </a>
          )}
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 font-medium mb-2"><Video className="h-4 w-4" />Gravações (MeetGeek)</div>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : gravacoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma gravação encontrada ainda. Ela aparece aqui quando o MeetGeek do gerente grava a reunião neste horário (pode levar alguns minutos depois do fim).
              </p>
            ) : gravacoes.map((g) => (
              <div key={g.id} className="rounded border border-border p-2 mb-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{g.title ?? 'Gravação'}</span>
                  <Button size="sm" variant="outline" disabled={abrindo === g.id} onClick={() => assistir(g.id)}>
                    {abrindo === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Assistir'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {g.started_at ? format(new Date(g.started_at), 'dd/MM HH:mm') : ''}{g.duration_minutes ? ` · ${g.duration_minutes} min` : ''}
                </p>
                {resumo(g.summary) && <p className="text-xs whitespace-pre-line line-clamp-6">{resumo(g.summary)}</p>}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
