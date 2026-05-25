import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trophy, Upload } from 'lucide-react';
import { safeFormatDate } from '@/lib/dateHelpers';
import { useResultadosGrupo, useInsertResultados } from '@/hooks/useGrupoSaudeDetalhe';
import { parseResultadoAssembleia } from '@/lib/parsers/embraconSaude';

export function ResultadoAssembleiaSection({ grupo }: { grupo: string }) {
  const { data = [] } = useResultadosGrupo(grupo);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [numero, setNumero] = useState('');
  const [dataAssembleia, setDataAssembleia] = useState('');
  const insert = useInsertResultados();

  // Agrupa por data_assembleia desc, mostra a mais recente expandida
  const ultima = useMemo(() => {
    if (data.length === 0) return null;
    const dt = data[0].data_assembleia;
    return { dt, rows: data.filter((r) => r.data_assembleia === dt) };
  }, [data]);

  const handleSave = async () => {
    const linhas = parseResultadoAssembleia(text);
    if (linhas.length === 0) return;
    const payload = linhas.map((l) => ({
      grupo,
      numero_assembleia: numero ? parseInt(numero, 10) : null,
      data_assembleia: dataAssembleia || l.dt_contemplacao || null,
      cota: l.cota,
      modalidade: l.modalidade,
      bem: l.bem,
      filial: l.filial,
      percentual_lance: l.percentual_lance,
      parcela: l.parcela,
      dt_contemplacao: l.dt_contemplacao,
    }));
    await insert.mutateAsync(payload);
    setOpen(false);
    setText('');
    setNumero('');
    setDataAssembleia('');
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Resultado da última assembleia
            {ultima && (
              <Badge variant="outline" className="text-xs">
                {safeFormatDate(ultima.dt)} · {ultima.rows.length} contempl.
              </Badge>
            )}
          </h3>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Registrar resultado
          </Button>
        </div>

        {!ultima ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum resultado registrado. Cole o resultado da assembleia para importar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cota</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Bem</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead className="text-right">% Lance</TableHead>
                <TableHead>Parc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultima.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.cota}</TableCell>
                  <TableCell className="text-sm">{r.modalidade || '—'}</TableCell>
                  <TableCell className="text-sm">{r.bem || '—'}</TableCell>
                  <TableCell className="text-sm">{r.filial || '—'}</TableCell>
                  <TableCell className="text-right text-sm">
                    {r.percentual_lance != null ? `${Number(r.percentual_lance).toFixed(2)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{r.parcela || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar resultado de assembleia — {grupo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Nº da assembleia</label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="5" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data da assembleia</label>
                <Input type="date" value={dataAssembleia} onChange={(e) => setDataAssembleia(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole as linhas de "Contemplações Confirmadas" (Cota · Modalidade · Bem · Filial · Datas · % Lance...).
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder="2918-00  2o Lance Fixo  IE130  000879  24/04/2026  24/04/2026  203  50,0000"
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!text.trim() || insert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}