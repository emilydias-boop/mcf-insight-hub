import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, RotateCcw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadXLSX } from '@/lib/lazyExport';
import { LeadCallButton } from '@/components/crm/LeadCallButton';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import { useSemSucesso, useRetomarContato } from '@/hooks/useConsorcioPostMeeting';

export function SemSucessoTab() {
  const { data: deals = [], isLoading } = useSemSucesso();
  const retomar = useRetomarContato();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Deals Sem Sucesso</CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={deals.length === 0}
          onClick={async () => {
            const XLSX = await loadXLSX();
            const data = deals.map(d => ({
              "Contato": d.contact_name || d.deal_name || '',
              "Telefone": d.contact_phone || '',
              "Email": d.contact_email || '',
              "Pipeline": d.origin_name || '',
              "Motivo": d.motivo_recusa || '',
              "Data": d.updated_at ? format(new Date(d.updated_at), 'dd/MM/yyyy', { locale: ptBR }) : '',
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sem Sucesso");
            XLSX.writeFile(wb, `sem-sucesso-consorcio-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
          }}
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar Excel
        </Button>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal sem sucesso.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map(d => (
                <TableRow key={d.deal_id} className="cursor-pointer" onClick={() => setSelectedDealId(d.deal_id)}>
                  <TableCell className="font-medium">
                    {d.contact_name || d.deal_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>{d.contact_phone || '—'}</span>
                          <LeadCallButton phone={d.contact_phone} dealId={d.deal_id} />
                        </div>
                      </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{d.origin_name}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {d.motivo_recusa || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.updated_at ? format(new Date(d.updated_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retomar.mutate({ deal_id: d.deal_id, origin_id: d.origin_id })}
                      disabled={retomar.isPending}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Retomar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
