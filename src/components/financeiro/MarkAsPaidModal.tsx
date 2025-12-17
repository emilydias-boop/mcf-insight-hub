import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMarkAsPaid } from '@/hooks/useFinanceiroPagamentos';
import { PagamentoPJ } from '@/types/financeiro';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface MarkAsPaidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagamento: PagamentoPJ;
  mes: number;
  ano: number;
  onSuccess: () => void;
}

export const MarkAsPaidModal = ({ open, onOpenChange, pagamento, mes, ano, onSuccess }: MarkAsPaidModalProps) => {
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const { markAsPaid } = useMarkAsPaid();

  const valorAPagar = pagamento.nfse?.valor_nfse || pagamento.fechamento?.total_conta || 0;

  const handleSubmit = async () => {
    if (!dataPagamento) {
      toast.error('Data de pagamento é obrigatória');
      return;
    }

    setIsLoading(true);
    try {
      await markAsPaid({
        employeeId: pagamento.employee.id,
        mes,
        ano,
        valorNfse: valorAPagar,
        dataPagamento,
        existingNfseId: pagamento.nfse?.id,
      });
      toast.success('Pagamento registrado com sucesso');
      onSuccess();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Erro ao registrar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como Pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-muted-foreground">Colaborador</Label>
            <p className="font-medium">{pagamento.employee.nome_completo}</p>
          </div>

          <div>
            <Label className="text-muted-foreground">Valor a Pagar</Label>
            <p className="text-2xl font-bold">{formatCurrency(valorAPagar)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataPagamento">Data de Pagamento *</Label>
            <Input
              id="dataPagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
