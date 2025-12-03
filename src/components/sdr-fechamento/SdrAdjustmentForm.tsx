import { useState } from 'react';
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
import { useAddAdjustment } from '@/hooks/useSdrFechamento';
import { useAuth } from '@/contexts/AuthContext';
import { Plus } from 'lucide-react';

interface SdrAdjustmentFormProps {
  payoutId: string;
  disabled?: boolean;
}

export const SdrAdjustmentForm = ({ payoutId, disabled }: SdrAdjustmentFormProps) => {
  const { user } = useAuth();
  const addAdjustment = useAddAdjustment();
  
  const [tipo, setTipo] = useState('');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tipo || !valor || !motivo || !user) return;

    const valorNum = parseFloat(valor.replace(',', '.'));
    if (isNaN(valorNum)) return;

    addAdjustment.mutate({
      payoutId,
      adjustment: {
        tipo,
        campo: tipo === 'acrescimo' ? 'valor_variavel_total' : 'valor_variavel_total',
        valor: tipo === 'desconto' ? -Math.abs(valorNum) : Math.abs(valorNum),
        motivo,
      },
      userId: user.id,
    }, {
      onSuccess: () => {
        setTipo('');
        setValor('');
        setMotivo('');
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Ajuste</Label>
          <Select value={tipo} onValueChange={setTipo} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acrescimo">Acréscimo</SelectItem>
              <SelectItem value="desconto">Desconto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input
            type="text"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Motivo (obrigatório)</Label>
        <Textarea
          placeholder="Descreva o motivo do ajuste..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          disabled={disabled}
          rows={2}
        />
      </div>

      <Button 
        type="submit" 
        disabled={disabled || !tipo || !valor || !motivo || addAdjustment.isPending}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Ajuste
      </Button>
    </form>
  );
};
