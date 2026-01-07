import { useState } from 'react';
import { useSdrLevels, useUpdateSdrLevel, useBulkApplyLevelToCompPlans, useSdrsByLevel } from '@/hooks/useSdrLevelMutations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Pencil, Zap, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface SdrLevel {
  level: number;
  fixo_valor: number;
  description: string | null;
  ote_total: number;
  variavel_total: number;
  valor_meta_rpg: number;
  valor_docs_reuniao: number;
  valor_tentativas: number;
  valor_organizacao: number;
  meta_reunioes_agendadas: number;
  meta_reunioes_realizadas: number;
  meta_tentativas: number;
  meta_organizacao: number;
  ifood_mensal: number;
  ifood_ultrameta: number;
  dias_uteis: number;
  meta_no_show_pct: number;
}

export const SdrLevelsTab = () => {
  const { data: levels, isLoading } = useSdrLevels();
  const { data: sdrsByLevel } = useSdrsByLevel();
  const updateLevel = useUpdateSdrLevel();
  const bulkApply = useBulkApplyLevelToCompPlans();

  const [editingLevel, setEditingLevel] = useState<SdrLevel | null>(null);
  const [applyingLevel, setApplyingLevel] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<SdrLevel>>({});

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleEdit = (level: SdrLevel) => {
    setEditingLevel(level);
    setFormData(level);
  };

  const handleSave = async () => {
    if (!editingLevel) return;
    
    try {
      await updateLevel.mutateAsync({
        level: editingLevel.level,
        data: formData
      });
      setEditingLevel(null);
      toast.success('Nível atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar nível');
    }
  };

  const handleBulkApply = async (nivel: number) => {
    const sdrsCount = sdrsByLevel?.[nivel] || 0;
    if (sdrsCount === 0) {
      toast.info('Não há SDRs neste nível');
      return;
    }
    setApplyingLevel(nivel);
  };

  const confirmBulkApply = async () => {
    if (applyingLevel === null) return;
    
    try {
      const result = await bulkApply.mutateAsync(applyingLevel);
      toast.success(`Planos OTE de ${result.updated} SDRs atualizados!`);
      setApplyingLevel(null);
    } catch (error) {
      toast.error('Erro ao aplicar em massa');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Níveis OTE</h3>
          <p className="text-sm text-muted-foreground">
            Configure os valores padrão por nível e aplique em massa aos planos OTE
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Nível</TableHead>
            <TableHead>Fixo</TableHead>
            <TableHead>OTE Total</TableHead>
            <TableHead>Variável</TableHead>
            <TableHead>Meta Agendadas</TableHead>
            <TableHead>Meta Realizadas</TableHead>
            <TableHead>SDRs</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {levels?.map((level: SdrLevel) => (
            <TableRow key={level.level}>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  N{level.level}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{formatCurrency(level.fixo_valor)}</TableCell>
              <TableCell>{formatCurrency(level.ote_total)}</TableCell>
              <TableCell>{formatCurrency(level.variavel_total)}</TableCell>
              <TableCell>{level.meta_reunioes_agendadas}</TableCell>
              <TableCell>{level.meta_reunioes_realizadas}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{sdrsByLevel?.[level.level] || 0}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(level)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleBulkApply(level.level)}
                    disabled={(sdrsByLevel?.[level.level] || 0) === 0}
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog de Edição */}
      <Dialog open={!!editingLevel} onOpenChange={() => setEditingLevel(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Nível {editingLevel?.level}</DialogTitle>
            <DialogDescription>
              Altere os valores padrão para este nível
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Fixo (R$)</Label>
              <Input
                type="number"
                value={formData.fixo_valor || 0}
                onChange={(e) => setFormData({ ...formData, fixo_valor: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>OTE Total (R$)</Label>
              <Input
                type="number"
                value={formData.ote_total || 0}
                onChange={(e) => setFormData({ ...formData, ote_total: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Variável Total (R$)</Label>
              <Input
                type="number"
                value={formData.variavel_total || 0}
                onChange={(e) => setFormData({ ...formData, variavel_total: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Meta RPG (R$)</Label>
              <Input
                type="number"
                value={formData.valor_meta_rpg || 0}
                onChange={(e) => setFormData({ ...formData, valor_meta_rpg: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Docs Reunião (R$)</Label>
              <Input
                type="number"
                value={formData.valor_docs_reuniao || 0}
                onChange={(e) => setFormData({ ...formData, valor_docs_reuniao: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Tentativas (R$)</Label>
              <Input
                type="number"
                value={formData.valor_tentativas || 0}
                onChange={(e) => setFormData({ ...formData, valor_tentativas: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Organização (R$)</Label>
              <Input
                type="number"
                value={formData.valor_organizacao || 0}
                onChange={(e) => setFormData({ ...formData, valor_organizacao: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta Reuniões Agendadas</Label>
              <Input
                type="number"
                value={formData.meta_reunioes_agendadas || 0}
                onChange={(e) => setFormData({ ...formData, meta_reunioes_agendadas: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta Reuniões Realizadas</Label>
              <Input
                type="number"
                value={formData.meta_reunioes_realizadas || 0}
                onChange={(e) => setFormData({ ...formData, meta_reunioes_realizadas: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta Tentativas</Label>
              <Input
                type="number"
                value={formData.meta_tentativas || 0}
                onChange={(e) => setFormData({ ...formData, meta_tentativas: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta Organização (%)</Label>
              <Input
                type="number"
                value={formData.meta_organizacao || 0}
                onChange={(e) => setFormData({ ...formData, meta_organizacao: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>iFood Mensal (R$)</Label>
              <Input
                type="number"
                value={formData.ifood_mensal || 0}
                onChange={(e) => setFormData({ ...formData, ifood_mensal: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>iFood Ultrameta (R$)</Label>
              <Input
                type="number"
                value={formData.ifood_ultrameta || 0}
                onChange={(e) => setFormData({ ...formData, ifood_ultrameta: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Dias Úteis</Label>
              <Input
                type="number"
                value={formData.dias_uteis || 22}
                onChange={(e) => setFormData({ ...formData, dias_uteis: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta No-Show (%)</Label>
              <Input
                type="number"
                value={formData.meta_no_show_pct || 30}
                onChange={(e) => setFormData({ ...formData, meta_no_show_pct: Number(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLevel(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateLevel.isPending}>
              {updateLevel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Aplicação em Massa */}
      <Dialog open={applyingLevel !== null} onOpenChange={() => setApplyingLevel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar em Massa - Nível {applyingLevel}</DialogTitle>
            <DialogDescription>
              Você está prestes a atualizar os planos OTE de {sdrsByLevel?.[applyingLevel!] || 0} SDRs do Nível {applyingLevel}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Os valores do Nível {applyingLevel} serão aplicados aos planos OTE ativos de todas as SDRs deste nível.
              Esta ação não pode ser desfeita.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyingLevel(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmBulkApply}
              disabled={bulkApply.isPending}
            >
              {bulkApply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Aplicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
