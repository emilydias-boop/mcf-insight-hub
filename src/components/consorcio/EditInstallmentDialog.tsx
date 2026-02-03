import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ConsorcioInstallment, TipoParcela, StatusParcela } from '@/types/consorcio';
import { parseDateWithoutTimezone, formatDateForDB } from '@/lib/dateHelpers';

interface EditInstallmentDialogProps {
  installment: ConsorcioInstallment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: UpdateInstallmentData) => Promise<void>;
  isSaving: boolean;
}

export interface UpdateInstallmentData {
  id: string;
  tipo: TipoParcela;
  valor_parcela: number;
  valor_comissao: number;
  data_vencimento: string;
  data_pagamento?: string | null;
  status: StatusParcela;
  observacao?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function EditInstallmentDialog({
  installment,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: EditInstallmentDialogProps) {
  const [tipo, setTipo] = useState<TipoParcela>('cliente');
  const [valorParcela, setValorParcela] = useState('');
  const [valorComissao, setValorComissao] = useState('');
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>();
  const [status, setStatus] = useState<StatusParcela>('pendente');
  const [observacao, setObservacao] = useState('');

  // Reset form when installment changes
  useEffect(() => {
    if (installment) {
      setTipo(installment.tipo);
      setValorParcela(Number(installment.valor_parcela).toFixed(2));
      setValorComissao(Number(installment.valor_comissao).toFixed(2));
      setDataVencimento(parseDateWithoutTimezone(installment.data_vencimento));
      setDataPagamento(
        installment.data_pagamento 
          ? parseDateWithoutTimezone(installment.data_pagamento) 
          : undefined
      );
      setStatus(installment.status);
      setObservacao(installment.observacao || '');
    }
  }, [installment]);

  const handleSave = async () => {
    if (!installment || !dataVencimento) return;

    await onSave({
      id: installment.id,
      tipo,
      valor_parcela: parseCurrencyInput(valorParcela),
      valor_comissao: parseCurrencyInput(valorComissao),
      data_vencimento: formatDateForDB(dataVencimento),
      data_pagamento: dataPagamento ? formatDateForDB(dataPagamento) : null,
      status,
      observacao: observacao.trim() || undefined,
    });
  };

  if (!installment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Parcela #{installment.numero_parcela}
          </DialogTitle>
          <DialogDescription>
            Altere os dados da parcela conforme necessário. Adicione uma observação para registrar o motivo da alteração.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Row 1: Tipo and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoParcela)}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusParcela)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Valor Parcela and Valor Comissão */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valorParcela">Valor da Parcela</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="valorParcela"
                  type="text"
                  value={valorParcela}
                  onChange={(e) => setValorParcela(e.target.value)}
                  className="pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorComissao">Valor da Comissão</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="valorComissao"
                  type="text"
                  value={valorComissao}
                  onChange={(e) => setValorComissao(e.target.value)}
                  className="pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dataVencimento && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimento ? format(dataVencimento, 'dd/MM/yyyy') : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataVencimento}
                    onSelect={setDataVencimento}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data de Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dataPagamento && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPagamento ? format(dataPagamento, 'dd/MM/yyyy') : 'Não pago'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataPagamento}
                    onSelect={setDataPagamento}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Row 4: Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Pago com juros de mora (R$ 50,00), alterado tipo de cliente para empresa..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !dataVencimento}>
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
