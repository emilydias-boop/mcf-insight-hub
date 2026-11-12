import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { POS_VENDA_ORIGIN_ID } from '@/lib/posVenda';
import { horariosLivresPosVenda, inicioSlotSP, type DisponibilidadePosVenda, type OcupacaoPosVenda } from '@/lib/posVendaDisponibilidade';
import { syncConvitePosVenda } from '@/lib/posVendaConvite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  return agora;
}

export function usePosVendaGerentes() {
  return useQuery({
    queryKey: ['pos-venda-gerentes'],
    queryFn: async () => {
      // RPC: gerentes não enxergam cargos/perfis dos colegas pelas regras de acesso.
      const { data, error } = await db.rpc('pos_venda_listar_gerentes');
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function usePosVendaDisponibilidade() {
  return useQuery({
    queryKey: ['pos-venda-disponibilidade'],
    queryFn: async () => {
      const { data, error } = await db.from('pos_venda_disponibilidade').select('gerente_id, dia_semana, horario');
      if (error) throw error;
      return (data ?? []) as DisponibilidadePosVenda[];
    },
  });
}

export function NovaReuniaoPosVendaDialog({ onClose, onSalvo, preSelecao, dealId: dealIdProp, dealNome }: {
  onClose: () => void;
  onSalvo?: () => void;
  preSelecao?: { gerenteId: string; dia: string; hora: string };
  dealId?: string;
  dealNome?: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: gerentes = [] } = usePosVendaGerentes();
  const [busca, setBusca] = useState('');
  const [dealId, setDealId] = useState(dealIdProp ?? '');
  const [gerenteId, setGerenteId] = useState(preSelecao?.gerenteId ?? user?.id ?? '');
  const [tipo, setTipo] = useState<'viabilidade_1' | 'viabilidade_2'>('viabilidade_1');
  const [data, setData] = useState(preSelecao?.dia ?? format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState(preSelecao?.hora ?? '10:00');
  const [duracao, setDuracao] = useState(60);
  const [link, setLink] = useState('');
  const { data: dealInfo } = useQuery({
    queryKey: ['pos-venda-deal-nome', dealIdProp],
    enabled: Boolean(dealIdProp),
    queryFn: async () => {
      const { data: d } = await db.from('crm_deals').select('name, stage_id, origin_id').eq('id', dealIdProp).maybeSingle();
      let stageName: string | null = null;
      if (d?.stage_id) {
        const { data: s } = await db.from('crm_stages').select('stage_name').eq('id', d.stage_id).maybeSingle();
        stageName = s?.stage_name ?? null;
      }
      return { name: (d?.name ?? null) as string | null, stageName, foraPosVenda: Boolean(d && d.origin_id !== POS_VENDA_ORIGIN_ID) };
    },
  });
  const [tipoSugerido, setTipoSugerido] = useState(false);
  useEffect(() => {
    if (!dealIdProp || tipoSugerido || !dealInfo) return;
    setTipo(dealInfo.stageName?.includes('Viabilidade 2') ? 'viabilidade_2' : 'viabilidade_1');
    setTipoSugerido(true);
  }, [dealIdProp, dealInfo, tipoSugerido]);
  const { data: disponibilidade = [], isLoading: carregandoDisponibilidade, isError: erroDisponibilidade } = usePosVendaDisponibilidade();
  const configurado = disponibilidade.some((d) => d.gerente_id === gerenteId);
  const agora = useAgora();
  const { data: ocupadas = [], isLoading: carregandoOcupadas, isError: erroOcupadas, refetch: atualizarOcupadas } = useQuery({
    queryKey: ['pos-venda-ocupacao', gerenteId, data],
    enabled: configurado && Boolean(data),
    queryFn: async () => {
      const inicio = inicioSlotSP(data, '00:00');
      const { data: reunioes, error } = await db.from('pos_venda_reunioes').select('gerente_id, inicio, duracao_min, status')
        .eq('gerente_id', gerenteId).neq('status', 'cancelada')
        .lt('inicio', new Date(+inicio + 86_400_000).toISOString())
        .gte('inicio', new Date(+inicio - 86_400_000).toISOString());
      if (error) throw error;
      return (reunioes ?? []) as OcupacaoPosVenda[];
    },
  });
  const livres = horariosLivresPosVenda(disponibilidade, gerenteId, data, ocupadas, duracao, agora);
  const aguardandoHorarios = carregandoDisponibilidade || erroDisponibilidade || (configurado && (carregandoOcupadas || erroOcupadas));
  useEffect(() => {
    if (configurado && !aguardandoHorarios && !livres.includes(hora)) setHora('');
  }, [configurado, aguardandoHorarios, livres.join(','), hora]);

  const { data: deals = [] } = useQuery({
    queryKey: ['pos-venda-deals-busca', busca],
    enabled: !dealIdProp,
    queryFn: async () => {
      let q = db.from('crm_deals').select('id, name').eq('origin_id', POS_VENDA_ORIGIN_ID).order('created_at', { ascending: false }).limit(30);
      const termo = busca.trim().replace(/[%,()]/g, ' ').trim();
      if (termo) {
        // Ignora acentos: cada letra que pode ter acento vira curinga de 1 caractere.
        const semAcento = termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const padrao = `%${semAcento.replace(/[aeiouc]/gi, '_')}%`;
        const digitos = termo.replace(/\D/g, '');
        const filtrosContato = [`name.ilike.${padrao}`, `email.ilike.%${termo}%`];
        if (digitos.length >= 4) filtrosContato.push(`phone.ilike.%${digitos.slice(-9)}%`);
        const { data: contatos } = await db.from('crm_contacts').select('id').or(filtrosContato.join(',')).limit(200);
        const ids = ((contatos ?? []) as { id: string }[]).map((c) => c.id);
        q = ids.length
          ? q.or(`name.ilike.${padrao},contact_id.in.(${ids.join(',')})`)
          : q.ilike('name', padrao);
      }
      const { data } = await q;
      return (data ?? []) as { id: string; name: string | null }[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (dealInfo?.foraPosVenda) throw new Error('Este cliente ainda não tem cartão no Pós-venda. Abra o cartão dele no funil Relacionamento - Pós venda para agendar.');
      if (aguardandoHorarios || (configurado && !livres.includes(hora))) throw new Error('Escolha um horário disponível.');
      const inicio = inicioSlotSP(data, hora).toISOString();
      const { data: criada, error } = await db.from('pos_venda_reunioes').insert({
        deal_id: dealId, gerente_id: gerenteId, tipo, inicio, duracao_min: duracao, link_reuniao: link || null,
      }).select('id').single();
      if (error) throw error;
      return (criada as { id: string }).id;
    },
    onSuccess: (id: string) => {
      syncConvitePosVenda('create', id);
      qc.invalidateQueries({ queryKey: ['pos-venda-reunioes'] });
      qc.invalidateQueries({ queryKey: ['pos-venda-ocupacao'] });
      const futura = inicioSlotSP(data, hora).getTime() > Date.now();
      toast.success(futura ? 'Reunião agendada. O convite vai por e-mail para o cliente.' : 'Reunião registrada.');
      onSalvo?.();
      onClose();
    },
    onError: (e: any) => { toast.error(e.message ?? 'Erro ao agendar'); atualizarOcupadas(); },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova reunião de viabilidade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente (pipeline Relacionamento - Pós venda)</Label>
            {dealIdProp ? (
              <p className="text-sm">Cliente: {dealNome ?? dealInfo?.name ?? '...'}</p>
            ) : (
              <>
                <Input placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <Select value={dealId} onValueChange={setDealId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
                  <SelectContent>{deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.name ?? d.id}</SelectItem>)}</SelectContent>
                </Select>
              </>
            )}
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
            <div><Label>Data</Label><Input type="date" min={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora (São Paulo)</Label>{configurado ? <Select value={hora} onValueChange={setHora} disabled={Boolean(aguardandoHorarios)}>
              <SelectTrigger><SelectValue placeholder={aguardandoHorarios ? 'Carregando...' : 'Escolha'} /></SelectTrigger>
              <SelectContent>{livres.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select> : <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={Boolean(aguardandoHorarios)} />}</div>
            <div><Label>Duração (min)</Label><Input type="number" min={10} max={480} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} /></div>
          </div>
          {configurado && !aguardandoHorarios && livres.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário disponível nesta data para esta duração.</p>}
          {(erroDisponibilidade || erroOcupadas) && <p className="text-sm text-destructive">Não foi possível consultar os horários disponíveis.</p>}
          <div><Label>Link da reunião (opcional — se vazio, o Google Meet é criado automaticamente)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!dealId || !gerenteId || !data || !hora || aguardandoHorarios || (configurado && !livres.includes(hora)) || salvar.isPending} onClick={() => salvar.mutate()}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
