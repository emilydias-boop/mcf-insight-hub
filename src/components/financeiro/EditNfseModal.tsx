import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateNfse } from '@/hooks/useFinanceiroPagamentos';
import { PagamentoPJ } from '@/types/financeiro';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EditNfseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagamento: PagamentoPJ;
  mes: number;
  ano: number;
  onSuccess: () => void;
}

export const EditNfseModal = ({ open, onOpenChange, pagamento, mes, ano, onSuccess }: EditNfseModalProps) => {
  const [formData, setFormData] = useState({
    numeroNfse: '',
    valorNfse: 0,
    arquivoUrl: '',
    dataEnvioNfse: '',
    statusPagamento: 'pendente' as 'pendente' | 'pago' | 'em_atraso',
    dataPagamento: '',
    observacoes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { updateNfse, createNfse } = useUpdateNfse();

  useEffect(() => {
    if (pagamento.nfse) {
      setFormData({
        numeroNfse: pagamento.nfse.numero_nfse || '',
        valorNfse: pagamento.nfse.valor_nfse || pagamento.fechamento?.total_conta || 0,
        arquivoUrl: pagamento.nfse.arquivo_url || '',
        dataEnvioNfse: pagamento.nfse.data_envio_nfse || '',
        statusPagamento: pagamento.nfse.status_pagamento || 'pendente',
        dataPagamento: pagamento.nfse.data_pagamento || '',
        observacoes: pagamento.nfse.observacoes || '',
      });
    } else {
      setFormData({
        numeroNfse: '',
        valorNfse: pagamento.fechamento?.total_conta || 0,
        arquivoUrl: '',
        dataEnvioNfse: format(new Date(), 'yyyy-MM-dd'),
        statusPagamento: 'pendente',
        dataPagamento: '',
        observacoes: '',
      });
    }
  }, [pagamento]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (pagamento.nfse) {
        // Update existing
        await updateNfse(pagamento.nfse.id, {
          numero_nfse: formData.numeroNfse || null,
          valor_nfse: formData.valorNfse,
          arquivo_url: formData.arquivoUrl || null,
          data_envio_nfse: formData.dataEnvioNfse || null,
          status_nfse: formData.numeroNfse ? 'nota_enviada' : 'pendente_envio',
          status_pagamento: formData.statusPagamento,
          data_pagamento: formData.dataPagamento || null,
          observacoes: formData.observacoes || null,
        });
      } else {
        // Create new
        await createNfse({
          employee_id: pagamento.employee.id,
          mes,
          ano,
          numero_nfse: formData.numeroNfse || null,
          valor_nfse: formData.valorNfse,
          arquivo_url: formData.arquivoUrl || null,
          storage_path: null,
          data_envio_nfse: formData.dataEnvioNfse || null,
          status_nfse: formData.numeroNfse ? 'nota_enviada' : 'pendente_envio',
          status_pagamento: formData.statusPagamento,
          data_pagamento: formData.dataPagamento || null,
          observacoes: formData.observacoes || null,
        });
      }
      toast.success('NFSe salva com sucesso');
      onSuccess();
    } catch (error) {
      console.error('Error saving NFSe:', error);
      toast.error('Erro ao salvar NFSe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {pagamento.nfse ? 'Editar NFSe' : 'Registrar NFSe'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-muted-foreground">Colaborador</Label>
            <p className="font-medium">{pagamento.employee.nome_completo}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mesAno">Mês / Ano</Label>
              <Input
                id="mesAno"
                value={`${String(mes).padStart(2, '0')}/${ano}`}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroNfse">Número NFSe</Label>
              <Input
                id="numeroNfse"
                value={formData.numeroNfse}
                onChange={(e) => setFormData({ ...formData, numeroNfse: e.target.value })}
                placeholder="Ex: 12345"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valorNfse">Valor NFSe (R$)</Label>
              <Input
                id="valorNfse"
                type="number"
                step="0.01"
                value={formData.valorNfse}
                onChange={(e) => setFormData({ ...formData, valorNfse: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataEnvioNfse">Data de Envio</Label>
              <Input
                id="dataEnvioNfse"
                type="date"
                value={formData.dataEnvioNfse}
                onChange={(e) => setFormData({ ...formData, dataEnvioNfse: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="arquivoUrl">URL do Arquivo</Label>
            <Input
              id="arquivoUrl"
              value={formData.arquivoUrl}
              onChange={(e) => setFormData({ ...formData, arquivoUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statusPagamento">Status Pagamento</Label>
              <Select
                value={formData.statusPagamento}
                onValueChange={(v) => setFormData({ ...formData, statusPagamento: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="em_atraso">Em atraso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataPagamento">Data Pagamento</Label>
              <Input
                id="dataPagamento"
                type="date"
                value={formData.dataPagamento}
                onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
