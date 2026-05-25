import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store } from 'lucide-react';
import { useCotasAVenda } from '@/hooks/useConsortiumTransfer';
import { ConsorcioCardDrawer } from '@/components/consorcio/ConsorcioCardDrawer';
import { format } from 'date-fns';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0));

export default function CotasAVendaPage() {
  const { data = [], isLoading } = useCotasAVenda();
  const [cardId, setCardId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Store className="h-6 w-6" /> Cotas à Venda
      </h1>
      <Card>
        <CardHeader><CardTitle className="text-base">{data.length} cota(s) disponível(eis)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titular</TableHead>
                <TableHead>Grupo/Cota</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Contemplada em</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma cota à venda</TableCell></TableRow>
              )}
              {data.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.tipo_pessoa === 'pf' ? c.nome_completo : c.razao_social}</TableCell>
                  <TableCell>{c.grupo} / {c.cota}</TableCell>
                  <TableCell>{fmtBRL(c.valor_credito)}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.tipo_produto}</Badge></TableCell>
                  <TableCell>{c.data_contemplacao ? format(new Date(c.data_contemplacao), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell>{c.vendedor_name || '-'}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => { setCardId(c.id); setOpen(true); }}>Abrir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConsorcioCardDrawer cardId={cardId} open={open} onOpenChange={setOpen} />
    </div>
  );
}