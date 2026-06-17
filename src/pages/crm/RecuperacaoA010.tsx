import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useA010RecoveryInspect, type InspectRow, type InspectItem, type InspectResponse } from '@/hooks/useA010RecoveryInspect';
import { toast } from 'sonner';
import { format } from 'date-fns';

function parseSheet(file: File, source: 'hubla' | 'kiwify'): Promise<InspectRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const rows: InspectRow[] = json.map((r) => {
          const keys = Object.keys(r);
          const find = (re: RegExp) => keys.find((k) => re.test(k));
          const name = String(r[find(/nome|name/i) || ''] || '').trim();
          const email = String(r[find(/e[-_ ]?mail/i) || ''] || '').trim().toLowerCase();
          const phone = String(r[find(/tel|phone|cel|whats/i) || ''] || '').trim();
          const product = String(r[find(/prod/i) || ''] || '').trim();
          const value = Number(String(r[find(/valor|price|amount/i) || ''] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          return { source, name, email, phone: phone || null, product: product || null, value };
        }).filter((r) => r.email || r.phone); // aceita linhas sem nome (fallback "Sem nome (A010)")
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}

const RISCO_BADGE: Record<string, string> = {
  baixo: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  medio: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  alto: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
};

function ItemsTable({ items }: { items: InspectItem[] }) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'hubla' | 'kiwify'>('all');
  const [riscoFilter, setRiscoFilter] = useState<'all' | 'baixo' | 'medio' | 'alto'>('all');

  const filtered = useMemo(() => items.filter((i) =>
    (sourceFilter === 'all' || i.planilha.source === sourceFilter) &&
    (riscoFilter === 'all' || i.risco === riscoFilter)
  ), [items, sourceFilter, riscoFilter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            <SelectItem value="hubla">Hubla</SelectItem>
            <SelectItem value="kiwify">Kiwify</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riscoFilter} onValueChange={(v) => setRiscoFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os riscos</SelectItem>
            <SelectItem value="baixo">Risco baixo</SelectItem>
            <SelectItem value="medio">Risco médio</SelectItem>
            <SelectItem value="alto">Risco alto</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground self-center">{filtered.length} de {items.length}</div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origem</TableHead>
              <TableHead>Planilha (nome / email / phone)</TableHead>
              <TableHead>Contato CRM</TableHead>
              <TableHead>Último deal</TableHead>
              <TableHead>Pipeline / Stage</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Risco</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item, i) => (
              <TableRow key={i}>
                <TableCell><Badge variant="outline">{item.planilha.source}</Badge></TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium flex items-center gap-2">
                    {item.planilha.name || <span className="italic text-muted-foreground">Sem nome</span>}
                    {item.missing_name && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">sem nome</Badge>}
                  </div>
                  <div className="text-muted-foreground">{item.planilha.email || '—'}</div>
                  <div className="text-muted-foreground">{item.planilha.phone || '—'}</div>
                </TableCell>
                <TableCell className="text-xs">
                  {item.contato_existente ? (
                    <>
                      <div className="font-medium">{item.contato_existente.name}</div>
                      <div className="text-muted-foreground">{item.contato_existente.email}</div>
                      <div className="text-muted-foreground">{item.contato_existente.phone}</div>
                    </>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {item.ultimo_deal ? (
                    <>
                      <div className="font-medium truncate max-w-[200px]">{item.ultimo_deal.name}</div>
                      <div className="text-muted-foreground">{item.ultimo_deal.product_name || '—'}</div>
                      <div className="text-muted-foreground">{format(new Date(item.ultimo_deal.created_at), 'dd/MM/yyyy')}</div>
                    </>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {item.ultimo_deal ? (
                    <>
                      <div>{item.ultimo_deal.pipeline || '—'}</div>
                      <div className="text-muted-foreground">{item.ultimo_deal.stage || '—'}</div>
                    </>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {(item.ultimo_deal?.tags || []).map((t, j) => <Badge key={j} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${RISCO_BADGE[item.risco]}`}>{item.risco}</span>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum item.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function RecuperacaoA010() {
  const [hublaFile, setHublaFile] = useState<File | null>(null);
  const [kiwifyFile, setKiwifyFile] = useState<File | null>(null);
  const [result, setResult] = useState<InspectResponse | null>(null);
  const inspect = useA010RecoveryInspect();

  const handleInspect = async () => {
    if (!hublaFile && !kiwifyFile) {
      toast.error('Selecione ao menos uma planilha (Hubla ou Kiwify).');
      return;
    }
    try {
      const rows: InspectRow[] = [];
      if (hublaFile) rows.push(...await parseSheet(hublaFile, 'hubla'));
      if (kiwifyFile) rows.push(...await parseSheet(kiwifyFile, 'kiwify'));
      if (rows.length === 0) {
        toast.error('Não consegui extrair linhas válidas das planilhas.');
        return;
      }
      const data = await inspect.mutateAsync(rows);
      setResult(data);
      toast.success(`Inspeção concluída: ${data.processed} linhas analisadas.`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao inspecionar planilhas.');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recuperação A010 — Auditoria</h1>
        <p className="text-muted-foreground text-sm">Faça upload das planilhas Hubla e Kiwify e revise os matches antes de executar o backfill.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Carregar planilhas</CardTitle>
          <CardDescription>Arquivos .xlsx com colunas reconhecíveis de nome, email, telefone e produto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Planilha Hubla (.xlsx)</Label>
              <Input type="file" accept=".xlsx" onChange={(e) => setHublaFile(e.target.files?.[0] || null)} />
              {hublaFile && <p className="text-xs text-muted-foreground">{hublaFile.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Planilha Kiwify (.xlsx)</Label>
              <Input type="file" accept=".xlsx" onChange={(e) => setKiwifyFile(e.target.files?.[0] || null)} />
              {kiwifyFile && <p className="text-xs text-muted-foreground">{kiwifyFile.name}</p>}
            </div>
          </div>
          <Button onClick={handleInspect} disabled={inspect.isPending}>
            {inspect.isPending ? 'Inspecionando…' : 'Rodar inspeção (não escreve nada)'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>2. Resultado</CardTitle>
            <CardDescription>
              {result.processed} linhas — {result.counts.matched_by_email} por email · {result.counts.matched_by_phone_only} só por telefone · {result.counts.no_match} sem match
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="phone">
              <TabsList>
                <TabsTrigger value="phone">Phone-only ({result.counts.matched_by_phone_only})</TabsTrigger>
                <TabsTrigger value="email">Email ({result.counts.matched_by_email})</TabsTrigger>
                <TabsTrigger value="none">Sem match ({result.counts.no_match})</TabsTrigger>
              </TabsList>
              <TabsContent value="phone" className="mt-4">
                <ItemsTable items={result.buckets.matched_by_phone_only} />
              </TabsContent>
              <TabsContent value="email" className="mt-4">
                <ItemsTable items={result.buckets.matched_by_email} />
              </TabsContent>
              <TabsContent value="none" className="mt-4">
                <ItemsTable items={result.buckets.no_match} />
              </TabsContent>
            </Tabs>

            <div className="mt-4 flex justify-end">
              <Button disabled title="Será habilitado no próximo passo (modo apply com decisões)">
                Executar backfill com a seleção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}