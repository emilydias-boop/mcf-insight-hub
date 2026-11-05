import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { POS_VENDA_ORIGIN_ID } from '@/lib/posVenda';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function MapaJornada() {
  const qc = useQueryClient();
  const consulta = useQuery({ queryKey: ['jornada-mapa'], queryFn: async () => {
    const [estagios, etapas, mapa] = await Promise.all([
      supabase.from('crm_stages').select('id,stage_name').eq('origin_id', POS_VENDA_ORIGIN_ID).order('stage_order'),
      supabase.from('jornada_etapas').select('id,titulo,codigo_trilha').eq('ativa', true).not('codigo_trilha', 'is', null).order('ordem'),
      supabase.from('jornada_mapa_estagios').select('stage_id,etapa_id'),
    ]);
    for (const r of [estagios, etapas, mapa]) if (r.error) throw r.error;
    return { estagios: estagios.data ?? [], etapas: etapas.data ?? [], mapa: mapa.data ?? [] };
  } });
  const salvar = useMutation({ mutationFn: async ({ stage, etapa }: { stage: string; etapa: string }) => {
    const r = etapa === 'nenhuma' ? await supabase.from('jornada_mapa_estagios').delete().eq('stage_id', stage)
      : await supabase.from('jornada_mapa_estagios').upsert({ stage_id: stage, etapa_id: etapa }, { onConflict: 'stage_id' });
    if (r.error) throw r.error;
  }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['jornada-mapa'] }); await qc.invalidateQueries({ queryKey: ['jornada'] }); toast.success('Mapeamento salvo.'); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Mapa de estágios da Jornada</h1>
    {consulta.error && <Alert variant="destructive"><AlertDescription>{consulta.error.message}</AlertDescription></Alert>}
    {consulta.isLoading ? <Skeleton className="h-40" /> : <Table><TableHeader><TableRow><TableHead>Estágio Pós-Venda</TableHead><TableHead>Fase da jornada</TableHead></TableRow></TableHeader><TableBody>{consulta.data?.estagios.map(s => <TableRow key={s.id}><TableCell>{s.stage_name}</TableCell><TableCell className="min-w-[240px]">
      <Select value={consulta.data.mapa.find(m => m.stage_id === s.id)?.etapa_id ?? 'nenhuma'} disabled={salvar.isPending} onValueChange={etapa => salvar.mutate({ stage: s.id, etapa })}><SelectTrigger aria-label={`Fase para ${s.stage_name}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhuma">Sem mapeamento</SelectItem>{consulta.data.etapas.map(e => <SelectItem key={e.id} value={e.id}>{e.codigo_trilha} · {e.titulo}</SelectItem>)}</SelectContent></Select>
    </TableCell></TableRow>)}</TableBody></Table>}
  </div>;
}