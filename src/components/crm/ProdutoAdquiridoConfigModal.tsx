import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Save } from 'lucide-react';
import {
  useAllProdutoAdquiridoOptions,
  useCreateProdutoAdquiridoOption,
  useUpdateProdutoAdquiridoOption,
  useDeleteProdutoAdquiridoOption,
} from '@/hooks/useDealProdutosAdquiridos';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProdutoAdquiridoConfigModal = ({ open, onOpenChange }: Props) => {
  const { data: options = [], isLoading } = useAllProdutoAdquiridoOptions();
  const createOption = useCreateProdutoAdquiridoOption();
  const updateOption = useUpdateProdutoAdquiridoOption();
  const deleteOption = useDeleteProdutoAdquiridoOption();

  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleCreate = () => {
    if (!newLabel.trim()) return;
    const name = newLabel.trim().toLowerCase().replace(/\s+/g, '_');
    createOption.mutate({ name, label: newLabel.trim() });
    setNewLabel('');
  };

  const handleSaveEdit = (id: string) => {
    if (!editLabel.trim()) return;
    updateOption.mutate({ id, label: editLabel.trim() });
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta opção?')) {
      deleteOption.mutate(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Opções de Produtos</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                {editingId === opt.id ? (
                  <>
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="flex-1 h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(opt.id)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(opt.id)}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      ✕
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="flex-1 text-sm cursor-pointer hover:underline"
                      onClick={() => { setEditingId(opt.id); setEditLabel(opt.label); }}
                    >
                      {opt.label}
                    </span>
                    <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => handleDelete(opt.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="Nova opção..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 h-8 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button size="sm" onClick={handleCreate} disabled={!newLabel.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
