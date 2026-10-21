import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';
import type { ScriptStepInput } from '@/hooks/useSalesScript';

interface Piloto {
  meeting_slot_id: string;
  closer_nome: string;
  scheduled_at: string;
  duracao_min: number | null;
  participantes: { nome: string | null; status: string; pago: boolean }[];
  pagos: number;
  recording_id: string | null;
  tem_transcricao: boolean;
  nota_geral: number | null;
}

interface Faixa { faixa: string; reunioes: number; participantes: number; contratos: number; taxa_pct: number | null }

interface Props {
  meetingType: 'r1' | 'r2';
  onRascunho: (etapas: (ScriptStepInput & { exemplo?: string })[]) => void;
}

export function ScriptPilotosSection({ meetingType, onRascunho }: Props) {
  const [sel, setSel] = useState<Set<string>>(new Set());

  const pilotos = useQuery({
    queryKey: ['script-pilotos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('script_piloto_reunioes' as never, { _dias: 120 } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Piloto[];
    },
    enabled: meetingType === 'r1',
  });

  const saude = useQuery({
    queryKey: ['script-saude', meetingType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('script_saude_faixas' as never, { _meeting_type: meetingType } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Faixa[];
    },
  });

  const gerar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke('gerar-script-piloto', {
        body: { recording_ids: ids, meeting_type: meetingType },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = (await error.context.json()).error ?? msg; } catch { /* mantém */ }
        }
        throw new Error(msg);
      }
      return data as { etapas: (ScriptStepInput & { exemplo?: string })[] };
    },
    onSuccess: (d) => {
      onRascunho(d.etapas ?? []);
      toast.success(`Rascunho com ${d.etapas?.length ?? 0} etapas carregado abaixo. Nada foi publicado.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao gerar o script.'),
  });

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 5) n.add(id);
      else toast.info('Escolha até 5 reuniões.');
      return n;
    });

  return (
    <div className="space-y-4">
      {meetingType === 'r1' && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Reuniões piloto (automático)</CardTitle>
            <Button size="sm" disabled={sel.size === 0 || gerar.isPending} onClick={() => gerar.mutate([...sel])}>
              <Sparkles className="mr-2 h-4 w-4" />
              {gerar.isPending ? 'Gerando…' : `Gerar script a partir das pilotos (${sel.size})`}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              R1 realizadas nos últimos 120 dias com 2 ou 3 participantes com Contrato Pago (sem reembolso). Entram e saem
              da lista sozinhas. Marque até 5 com transcrição para gerar o rascunho.
            </p>
            {pilotos.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (pilotos.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reunião piloto no período.</p>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {(pilotos.data ?? []).map((p) => (
                  <label key={p.meeting_slot_id} className="flex cursor-pointer flex-wrap items-start gap-3 p-3 text-sm">
                    <Checkbox
                      disabled={!p.tem_transcricao || !p.recording_id}
                      checked={!!p.recording_id && sel.has(p.recording_id)}
                      onCheckedChange={() => p.recording_id && toggle(p.recording_id)}
                      aria-label={`Selecionar reunião de ${p.closer_nome}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.closer_nome}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(p.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          {p.duracao_min ? ` · ${p.duracao_min} min` : ''}
                        </span>
                        <Badge variant="secondary">{p.pagos} contrato(s) pago(s)</Badge>
                        {p.tem_transcricao ? (
                          p.nota_geral != null && <Badge variant="outline">Nota {Number(p.nota_geral).toFixed(1)}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-dashed text-muted-foreground">piloto sem transcrição</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.participantes.map((a, i) => (
                          <Badge key={i} variant={a.pago ? 'default' : 'outline'} className="font-normal">
                            {a.nome ?? '—'}{a.pago ? ' · Contrato Pago' : a.status === 'no_show' ? ' · No-show' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-0">
          <CardTitle className="text-base">Saúde do script</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Taxa de contrato pago (sem reembolso) por faixa de nota da reunião. Participantes sem no-show.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(saude.data ?? []).map((f) => (
              <div key={f.faixa} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Nota {f.faixa}</div>
                <div className="text-xl font-semibold">
                  {f.taxa_pct != null ? `${Number(f.taxa_pct).toLocaleString('pt-BR')}%` : '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {f.contratos} de {f.participantes} · {f.reunioes} reuniões
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
