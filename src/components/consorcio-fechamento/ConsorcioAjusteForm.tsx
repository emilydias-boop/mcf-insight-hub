import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface ConsorcioAjusteFormProps {
  onAdd: (ajuste: { descricao: string; valor: number; tipo: 'bonus' | 'desconto' }) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ConsorcioAjusteForm({ onAdd, isLoading, disabled }: ConsorcioAjusteFormProps) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<'bonus' | 'desconto'>('bonus');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || !valor) return;
    
    onAdd({
      descricao: descricao.trim(),
      valor: parseFloat(valor),
      tipo,
    });
    
    setDescricao('');
    setValor('');
    setTipo('bonus');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adicionar Ajuste</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Bônus por performance excepcional"
                disabled={disabled}
                rows={2}
              />
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as 'bonus' | 'desconto')} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">Bônus (+)</SelectItem>
                    <SelectItem value="desconto">Desconto (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || disabled || !descricao.trim() || !valor}>
              <Plus className="h-4 w-4 mr-2" />
              {isLoading ? 'Adicionando...' : 'Adicionar Ajuste'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
