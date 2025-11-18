import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateClintOrigin, useUpdateClintOrigin } from '@/hooks/useClintAPI';
import { Plus, Edit } from 'lucide-react';

interface OriginFormDialogProps {
  origin?: any;
  trigger?: React.ReactNode;
}

export const OriginFormDialog = ({ origin, trigger }: OriginFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(origin?.name || '');
  const [description, setDescription] = useState(origin?.description || '');
  
  const createMutation = useCreateClintOrigin();
  const updateMutation = useUpdateClintOrigin();
  
  const isEditing = !!origin;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name,
      description: description || undefined,
    };
    
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: origin.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setOpen(false);
      // Reset form if creating
      if (!isEditing) {
        setName('');
        setDescription('');
      }
    } catch (error) {
      console.error('Error saving origin:', error);
    }
  };
  
  const defaultTrigger = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
      {isEditing ? (
        <>
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </>
      ) : (
        <>
          <Plus className="h-4 w-4 mr-2" />
          Nova Origem
        </>
      )}
    </Button>
  );
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? 'Editar Origem' : 'Nova Origem'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Nome da Origem *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Instagram, Site, Indicação..."
              required
              className="bg-background border-border text-foreground"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">
              Descrição
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva esta origem de leads..."
              rows={3}
              className="bg-background border-border text-foreground resize-none"
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Salvando...'
                : isEditing
                ? 'Atualizar Origem'
                : 'Criar Origem'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
