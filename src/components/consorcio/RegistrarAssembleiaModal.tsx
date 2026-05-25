import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { useRegistrarAssembleia } from '@/hooks/useContemplacaoEngine';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  grupo: string;
}

type Linha = { cota: string; motivo: 'sorteio' | 'lance_livre' | 'lance_fixo'; percentual_lance: string };

export function RegistrarAssembleiaModal({ open, onOpenChange, grupo }: Props) {
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [numero, setNumero] = useState('');
  const [observacao, setObservacao] = useState('');
  const [contemplados, setContemplados] = useState<Linha[]>([{ cota: '', motivo: 'sorteio', percentual_lance: '' }]);
  const registrar = useRegistrarAssembleia();

  const reset = () => {
    setData(new Date().toISOString().split('T')[0]);
    setNumero('');
    setObservacao('');
    setContemplados([{ cota: '', motivo: 'sorteio', percentual_lance: '' }]);
  };

  const handleClose = () => { reset(); onOpenChange(false); };

  const addLinha = () => setContemplados((p) => [...p, { cota: '', motivo: 'sorteio', percentual_lance: '' }]);
  const removeLinha = (i: number) => setContemplados((p) => p.filter((_, idx) => idx !== i));
  const updateLinha = (i: number, field: keyof Linha, val: string) =>
    setContemplados((p) => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleSave = async () => {
    const validos = contemplados.filter((c) => c.cota.trim());
    await registrar.mutateAsync({
      grupo,
      data_assembleia: data,
      numero_loteria_aplicado: numero || undefined,
      observacao: observacao || undefined,
      contemplados: validos.map((c) => ({
        cota: c.cota.trim(),
        motivo: c.motivo,
        percentual_lance: c.motivo === 'sorteio' ? null : (c.percentual_lance ? Number(c.percentual_lance) : null),
      })),
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Registrar assembleia anterior — Grupo {grupo}</DialogTitle>
          <DialogDescription>Cadastre as contemplações que ocorreram para alimentar a média histórica.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Data da assembleia *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nº Loteria aplicado</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} maxLength={5} placeholder="ex: 1600" />
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Contemplados</Label>
            <Button size="sm" variant="outline" onClick={addLinha}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
          <div className="space-y-2">
            {contemplados.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_120px_40px] gap-2 items-end">
                <div>
                  {i === 0 && <Label className="text-xs">Cota</Label>}
                  <Input value={c.cota} onChange={(e) => updateLinha(i, 'cota', e.target.value)} placeholder="ex: 1614" />
                </div>
                <div>
                  {i === 0 && <Label className="text-xs">Motivo</Label>}
                  <Select value={c.motivo} onValueChange={(v) => updateLinha(i, 'motivo', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sorteio">Sorteio</SelectItem>
                      <SelectItem value="lance_livre">Lance livre</SelectItem>
                      <SelectItem value="lance_fixo">Lance fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {i === 0 && <Label className="text-xs">% Lance</Label>}
                  <Input type="number" value={c.percentual_lance} onChange={(e) => updateLinha(i, 'percentual_lance', e.target.value)} disabled={c.motivo === 'sorteio'} placeholder={c.motivo === 'sorteio' ? '—' : '50'} />
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeLinha(i)} disabled={contemplados.length === 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={registrar.isPending}>Salvar assembleia</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}