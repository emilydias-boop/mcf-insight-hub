import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateExam } from '@/hooks/useExams';
import { format } from 'date-fns';

interface ExamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExamFormDialog({ open, onOpenChange }: ExamFormDialogProps) {
  const createExam = useCreateExam();
  
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataAplicacao, setDataAplicacao] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim()) return;

    await createExam.mutateAsync({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      data_aplicacao: dataAplicacao,
    });

    // Reset form
    setTitulo('');
    setDescricao('');
    setDataAplicacao(format(new Date(), 'yyyy-MM-dd'));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Prova</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Prova *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Prova Semanal - Técnicas de Venda"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data de Aplicação</Label>
            <Input
              id="data"
              type="date"
              value={dataAplicacao}
              onChange={(e) => setDataAplicacao(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              placeholder="Descrição ou observações sobre a prova..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createExam.isPending || !titulo.trim()}>
              {createExam.isPending ? 'Criando...' : 'Criar Prova'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
