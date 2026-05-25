import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { useFaixasRecomendacao, useUpsertFaixa, useDeleteFaixa, type FaixaRecomendacao } from '@/hooks/useContemplacaoEngine';

const CATEGORIAS: { value: string; label: string }[] = [
  { value: 'imovel', label: 'Imóvel' },
  { value: 'auto', label: 'Auto' },
  { value: 'moto', label: 'Moto' },
  { value: 'servicos', label: 'Serviços' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function FaixasConfigDialog({ open, onOpenChange }: Props) {
  const { data: faixas = [], isLoading } = useFaixasRecomendacao();
  const upsert = useUpsertFaixa();
  const del = useDeleteFaixa();
  const [drafts, setDrafts] = useState<Record<string, Partial<FaixaRecomendacao>>>({});
  const [novo, setNovo] = useState<Partial<FaixaRecomendacao>>({ tipo_produto: 'imovel', distancia_min: 0, distancia_max: 50, percentual_lance: 25, ordem: 1 });

  const getValue = (f: FaixaRecomendacao, field: keyof FaixaRecomendacao): any => {
    const d = drafts[f.id] || {};
    return field in d ? (d as any)[field] : (f as any)[field];
  };

  const updateDraft = (id: string, field: keyof FaixaRecomendacao, value: any) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const saveRow = async (f: FaixaRecomendacao) => {
    const d = drafts[f.id];
    if (!d) return;
    await upsert.mutateAsync({ id: f.id, tipo_produto: f.tipo_produto, ...d } as any);
    setDrafts((prev) => { const { [f.id]: _, ...rest } = prev; return rest; });
  };

  const addNovo = async () => {
    if (!novo.tipo_produto) return;
    await upsert.mutateAsync(novo as any);
    setNovo({ tipo_produto: 'imovel', distancia_min: 0, distancia_max: 50, percentual_lance: 25, ordem: 1 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Faixas de recomendação por tipo de bem</DialogTitle>
          <DialogDescription>
            Define qual lance recomendar para cada faixa de distância (cota vs nº sorteado).
            Deixe "% Lance" vazio para marcar como "não compensa".
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de bem</TableHead>
              <TableHead className="w-24">Dist. min</TableHead>
              <TableHead className="w-24">Dist. max</TableHead>
              <TableHead className="w-24">% Lance</TableHead>
              <TableHead className="w-20">Ordem</TableHead>
              <TableHead className="w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>
            ) : faixas.map((f) => {
              const dirty = !!drafts[f.id];
              return (
                <TableRow key={f.id}>
                  <TableCell>
                    <Select value={getValue(f, 'tipo_produto')} onValueChange={(v) => updateDraft(f.id, 'tipo_produto', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" value={getValue(f, 'distancia_min') ?? ''} onChange={(e) => updateDraft(f.id, 'distancia_min', Number(e.target.value))} /></TableCell>
                  <TableCell><Input type="number" placeholder="∞" value={getValue(f, 'distancia_max') ?? ''} onChange={(e) => updateDraft(f.id, 'distancia_max', e.target.value === '' ? null : Number(e.target.value))} /></TableCell>
                  <TableCell><Input type="number" placeholder="—" value={getValue(f, 'percentual_lance') ?? ''} onChange={(e) => updateDraft(f.id, 'percentual_lance', e.target.value === '' ? null : Number(e.target.value))} /></TableCell>
                  <TableCell><Input type="number" value={getValue(f, 'ordem')} onChange={(e) => updateDraft(f.id, 'ordem', Number(e.target.value))} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {dirty && <Button size="icon" variant="ghost" onClick={() => saveRow(f)}><Save className="h-4 w-4" /></Button>}
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/30">
              <TableCell>
                <Select value={novo.tipo_produto as string} onValueChange={(v) => setNovo((n) => ({ ...n, tipo_produto: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input type="number" value={novo.distancia_min ?? 0} onChange={(e) => setNovo((n) => ({ ...n, distancia_min: Number(e.target.value) }))} /></TableCell>
              <TableCell><Input type="number" placeholder="∞" value={novo.distancia_max ?? ''} onChange={(e) => setNovo((n) => ({ ...n, distancia_max: e.target.value === '' ? null : Number(e.target.value) }))} /></TableCell>
              <TableCell><Input type="number" placeholder="—" value={novo.percentual_lance ?? ''} onChange={(e) => setNovo((n) => ({ ...n, percentual_lance: e.target.value === '' ? null : Number(e.target.value) }))} /></TableCell>
              <TableCell><Input type="number" value={novo.ordem ?? 1} onChange={(e) => setNovo((n) => ({ ...n, ordem: Number(e.target.value) }))} /></TableCell>
              <TableCell><Button size="sm" onClick={addNovo}><Plus className="h-4 w-4 mr-1" />Adicionar</Button></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}