import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClosersList } from '@/hooks/useClosers';

interface FormData {
  attendeeName: string;
  attendeePhone: string;
  attendeeEmail: string;
  closerId: string;
  notes: string;
}

interface AddExternalSaleModalProps {
  weekStart: Date;
}

export function AddExternalSaleModal({ weekStart }: AddExternalSaleModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: closers = [] } = useClosersList();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      attendeeName: '',
      attendeePhone: '',
      attendeeEmail: '',
      closerId: '',
      notes: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('r2_vendas_extras')
        .insert({
          week_start: format(weekStart, 'yyyy-MM-dd'),
          attendee_name: data.attendeeName,
          attendee_phone: data.attendeePhone || null,
          attendee_email: data.attendeeEmail || null,
          closer_id: data.closerId || null,
          notes: data.notes || null,
        });

      if (error) throw error;

      toast.success('Venda externa adicionada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['r2-metrics-data'] });
      reset();
      setOpen(false);
    } catch (error) {
      console.error('Error adding external sale:', error);
      toast.error('Erro ao adicionar venda externa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Venda Externa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Venda Externa</DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground mb-4">
          Adicione uma venda de um lead que não estava no carrinho da semana de{' '}
          <strong>{format(weekStart, "dd 'de' MMMM", { locale: ptBR })}</strong>.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attendeeName">Nome do Cliente *</Label>
            <Input
              id="attendeeName"
              placeholder="Nome completo"
              {...register('attendeeName', { required: 'Nome é obrigatório' })}
            />
            {errors.attendeeName && (
              <p className="text-xs text-destructive">{errors.attendeeName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendeePhone">Telefone</Label>
            <Input
              id="attendeePhone"
              placeholder="(11) 99999-9999"
              {...register('attendeePhone')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendeeEmail">Email</Label>
            <Input
              id="attendeeEmail"
              type="email"
              placeholder="cliente@email.com"
              {...register('attendeeEmail')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="closerId">Closer Responsável</Label>
            <Select
              value={watch('closerId')}
              onValueChange={(value) => setValue('closerId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um closer" />
              </SelectTrigger>
              <SelectContent>
                {closers
                  .filter(c => c.is_active)
                  .map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Notas sobre esta venda..."
              rows={3}
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Adicionar Venda'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
