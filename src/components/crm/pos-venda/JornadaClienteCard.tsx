import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: unknown) => any };

interface Props { dealId: string; customFields: Record<string, unknown> | null }

export function JornadaClienteCard({ dealId, customFields }: Props) {
  const qc = useQueryClient();
  const [etapa, setEtapa] = useState('');
  const [obs, setObs] = useState('');
  const harvey = !!String(customFields?.harvey_cliente_id ?? '').trim();

  const { data } = useQuery({
    queryKey: ['jornada', dealId],
    queryFn: async () => {
      const [et, ev, dl] = await Promise.all([
        db.from('jornada_etapas').select('id, ordem, titulo, ativa').order('ordem'),
        db.from('jornada_eventos').select('id, etapa_id, ocorrido_em, registrado_por, observacao').eq('deal_id', dealId).order('ocorrido_em', { ascending: false }),
        db.from('crm_deals').select('jornada_etapa_atual_id').eq('id', dealId).maybeSingle(),
      ]);
      const ids = [...new Set((ev.data ?? []).map((e: { registrado_por: string | null }) => e.registrado_por).filter(Boolean))];
      const { data: profs } = ids.length ? await db.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
      return {
        etapas: (et.data ?? []) as { id: string; ordem: number; titulo: string; ativa: boolean }[],
        eventos: (ev.data ?? []) as { id: string; etapa_id: string; ocorrido_em: string; registrado_por: string | null; observacao: string | null }[],
        atual: dl.data?.jornada_etapa_atual_id as string | null,
        nomes: new Map<string, string>((profs ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])),
      };
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc('jornada_definir_etapa', { p_deal_id: dealId, p_etapa_id: etapa, p_observacao: obs || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Etapa da jornada atualizada'); setObs(''); setEtapa(''); qc.invalidateQueries({ queryKey: ['jornada', dealId] }); },
    onError: (e: Error) => toast.error('Não foi possível mudar a etapa', { description: e.message }),
  });

  const titulo = (id: string | null) => data?.etapas.find((e) => e.id === id)?.titulo ?? '—';

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Jornada do cliente</CardTitle>
        <Badge variant={harvey ? 'default' : 'outline'}>
          {harvey ? 'Cadastro no HARVEY confirmado' : 'Cadastro no HARVEY não confirmado'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>Etapa atual: <strong>{data ? titulo(data.atual) : '…'}</strong></div>
        <div className="flex gap-2">
          <Select value={etapa} onValueChange={setEtapa}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Mudar etapa…" /></SelectTrigger>
            <SelectContent>
              {data?.etapas.filter((e) => e.ativa).map((e) => <SelectItem key={e.id} value={e.id}>{e.titulo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!etapa || salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </div>
        {etapa && <Textarea rows={2} maxLength={500} placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />}
        <ol className="border-l pl-3 space-y-2">
          {data?.eventos.length === 0 && <li className="text-muted-foreground">Nenhum registro ainda.</li>}
          {data?.eventos.map((e) => (
            <li key={e.id}>
              <div className="font-medium">{titulo(e.etapa_id)}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(e.ocorrido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })} · {e.registrado_por ? data.nomes.get(e.registrado_por) ?? 'Usuário' : 'Automático'}
              </div>
              {e.observacao && e.observacao !== 'Automático' && <div className="text-xs">{e.observacao}</div>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
