import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Activity, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
import { useGrupoSaude, useUpsertGrupoSaude } from '@/hooks/useGrupoSaudeDetalhe';
import { parseDemonstrativo } from '@/lib/parsers/embraconSaude';

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function StatCell({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-2 rounded-md border bg-muted/30">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value ?? '—'}</p>
    </div>
  );
}

export function SaudeGrupoSection({ grupo }: { grupo: string }) {
  const { data } = useGrupoSaude(grupo);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const upsert = useUpsertGrupoSaude();

  const handleSave = async () => {
    const parsed = parseDemonstrativo(text);
    await upsert.mutateAsync({ grupo, ...parsed, fonte: 'demonstrativo_embracon' });
    setOpen(false);
    setText('');
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Saúde financeira & participantes
          </h3>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Atualizar dados
          </Button>
        </div>

        {!data ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum dado de saúde registrado. Cole o demonstrativo do grupo para preencher.
          </p>
        ) : (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <StatCell label="Ativos" value={data.ativos} />
              <StatCell label="Desis./Excl." value={data.desistentes_excluidos} />
              <StatCell label="Quitados" value={data.quitados} />
              <StatCell label="Contemplados" value={data.contemplados} />
              <StatCell label="Não Contemp." value={data.nao_contemplados} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Bens entregues" value={data.bens_entregues} />
              <StatCell label="Distribuídos" value={data.bens_distribuidos} />
              <StatCell label="Não distribuídos" value={data.bens_nao_distribuidos} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StatCell label="Disponibilidades" value={fmtCurrency(data.disponibilidades_total)} />
              <StatCell label="Aplic. vinc. contempl." value={fmtCurrency(data.aplic_financeiras)} />
              <StatCell label="Bens a entregar" value={fmtCurrency(data.valor_bens_a_entregar)} />
              <StatCell
                label="Próx. parcela"
                value={
                  data.proxima_parcela_vencimento
                    ? format(parseDateWithoutTimezone(data.proxima_parcela_vencimento), 'dd/MM/yyyy')
                    : '—'
                }
              />
              <StatCell label="Valor próx. parcela" value={fmtCurrency(data.proxima_parcela_valor)} />
            </div>
            {data.atualizado_em && (
              <p className="text-[11px] text-muted-foreground">
                Atualizado em{' '}
                {format(new Date(data.atualizado_em), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Atualizar saúde do grupo {grupo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Cole o texto do "Demonstrativo do Grupo" da Embracon. Os campos serão extraídos automaticamente.
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Cole aqui o demonstrativo (Participantes, Bens, Disponibilidades...)"
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!text.trim() || upsert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}