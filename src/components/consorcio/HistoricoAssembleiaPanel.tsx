import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, History } from 'lucide-react';
import { useHistoricoAssembleiasGrupo, useDeleteAssembleia, calcularVagasEstimadas } from '@/hooks/useContemplacaoEngine';
import { RegistrarAssembleiaModal } from './RegistrarAssembleiaModal';

interface Props {
  grupo: string;
  vagasFallback: number;
}

export function HistoricoAssembleiaPanel({ grupo, vagasFallback }: Props) {
  const [open, setOpen] = useState(false);
  const { data: historico = [], isLoading } = useHistoricoAssembleiasGrupo(grupo);
  const del = useDeleteAssembleia();
  const { vagas, media, baseAssembleias } = calcularVagasEstimadas(historico, vagasFallback);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico do Grupo {grupo}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Registrar assembleia
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {baseAssembleias > 0 ? (
            <>
              <Badge variant="outline">
                Média: <strong className="ml-1">{media.toFixed(2)}</strong> contemplados/assembleia
              </Badge>
              <Badge className="bg-primary text-primary-foreground">
                Vagas estimadas próxima: <strong className="ml-1">{vagas}</strong>
              </Badge>
              <span className="text-muted-foreground text-xs">base: últimas {baseAssembleias} assembleias</span>
            </>
          ) : (
            <Badge variant="outline">
              Sem histórico — usando padrão de {vagasFallback} vaga(s) por assembleia
            </Badge>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma assembleia registrada para este grupo.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nº Loteria</TableHead>
                <TableHead className="text-center">Contemplados</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{new Date(h.data_assembleia + 'T00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-mono">{h.numero_loteria_aplicado || '—'}</TableCell>
                  <TableCell className="text-center font-semibold">{h.qtd_contemplados}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.observacao || '—'}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (confirm('Remover esta assembleia do histórico?')) del.mutate(h.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RegistrarAssembleiaModal open={open} onOpenChange={setOpen} grupo={grupo} />
    </Card>
  );
}