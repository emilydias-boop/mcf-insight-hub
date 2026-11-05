import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props { dealId: string; customFields: Record<string, unknown> | null }
type Calculo = { etapa_atual: string; historico: Record<string, string | null>; harvey_confirmado: boolean };
export function JornadaClienteCard({ dealId }: Props) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['jornada', dealId],
    queryFn: async () => {
      const [et, calculo] = await Promise.all([
        supabase.from('jornada_etapas').select('codigo_trilha,titulo').not('codigo_trilha', 'is', null).order('ordem'),
        supabase.rpc('jornada_calcular', { p_deal_id: dealId }),
      ]);
      if (et.error) throw et.error;
      if (calculo.error) throw calculo.error;
      return { etapas: et.data ?? [], calculo: calculo.data as Calculo | null };
    },
  });
  const harvey = data?.calculo?.harvey_confirmado ?? false;
  const titulo = data?.etapas.find(e => e.codigo_trilha === data.calculo?.etapa_atual)?.titulo ?? '—';
  return <Card>
    <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
      <CardTitle className="text-sm">Jornada do cliente</CardTitle>
      {!isLoading && !error && data?.calculo && <Badge variant={harvey ? 'default' : 'outline'}>{harvey ? 'Cadastro no HARVEY confirmado' : 'Cadastro no HARVEY não confirmado'}</Badge>}
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {error && <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>}
      <div>Etapa atual: <strong>{isLoading ? '…' : titulo}</strong></div>
      <ol className="space-y-2 border-l pl-3">{data?.etapas.map(e => {
        const dataEvento = e.codigo_trilha ? data.calculo?.historico[e.codigo_trilha] : null;
        return <li key={e.codigo_trilha}><div className="font-medium">{e.titulo}</div><div className="text-xs text-muted-foreground">{dataEvento ? new Date(dataEvento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Sem registro'}</div></li>;
      })}</ol>
    </CardContent>
  </Card>;
}
