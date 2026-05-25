import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
import { useCalendarioGrupo, useUpsertCalendario } from '@/hooks/useGrupoSaudeDetalhe';
import { parseCalendario } from '@/lib/parsers/embraconSaude';

export function CalendarioAssembleiasSection({ grupo }: { grupo: string }) {
  const { data = [] } = useCalendarioGrupo(grupo);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const upsert = useUpsertCalendario();

  const todayIso = new Date().toISOString().slice(0, 10);
  const futuras = data.filter((a) => a.data_assembleia >= todayIso);

  const handleImport = async () => {
    const linhas = parseCalendario(text).filter((l) => l.grupo === grupo || l.grupo === grupo.padStart(6, '0'));
    if (linhas.length === 0) {
      // Aceita também linhas sem prefixo grupo coincidente — usa o grupo atual
      const all = parseCalendario(text).map((l) => ({ ...l, grupo }));
      await upsert.mutateAsync(all);
    } else {
      await upsert.mutateAsync(linhas.map((l) => ({ ...l, grupo })));
    }
    setOpen(false);
    setText('');
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Próximas assembleias
          </h3>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Importar calendário
          </Button>
        </div>

        {futuras.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma assembleia futura cadastrada. Cole o calendário Embracon para importar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Sorteio</TableHead>
                <TableHead className="text-right">Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {futuras.slice(0, 12).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{String(a.numero).padStart(3, '0')}</TableCell>
                  <TableCell>{format(parseDateWithoutTimezone(a.data_assembleia), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-sm">{a.dia_semana || '—'}</TableCell>
                  <TableCell className="text-sm">
                    {a.vencimento ? format(parseDateWithoutTimezone(a.vencimento), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.sorteio ? format(parseDateWithoutTimezone(a.sorteio), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">{a.horario || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar calendário de assembleias — {grupo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Cole as linhas do calendário Embracon (Grupo · Nº · Data · Dia · Vencimento · Sorteio · Hora).
              Se as linhas não tiverem o grupo, o grupo atual será usado.
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="007272  001  25/05/2026  Seg  20/05/2026  23/05/2026  09:00"
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!text.trim() || upsert.isPending}>
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}