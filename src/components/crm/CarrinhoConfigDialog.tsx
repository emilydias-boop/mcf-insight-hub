import { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CarrinhoConfig, CarrinhoItem } from '@/hooks/useCarrinhoConfig';
import { Card, CardContent } from '@/components/ui/card';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

interface CarrinhoConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: CarrinhoConfig;
  onSave: (config: CarrinhoConfig) => void;
  isSaving: boolean;
}

function makeDefaultCarrinho(id: number): CarrinhoItem {
  return {
    id,
    label: `Carrinho ${id}`,
    dias: id === 1 ? [1, 2, 3] : [4, 5],
    horario_corte: '12:00',
    horario_reuniao: '12:00',
  };
}

export function CarrinhoConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
  isSaving,
}: CarrinhoConfigDialogProps) {
  const [numCarrinhos, setNumCarrinhos] = useState(config.carrinhos.length);
  const [carrinhos, setCarrinhos] = useState<CarrinhoItem[]>(config.carrinhos);

  useEffect(() => {
    if (open) {
      setCarrinhos(config.carrinhos);
      setNumCarrinhos(config.carrinhos.length);
    }
  }, [open, config]);

  const handleNumChange = (val: string) => {
    const num = parseInt(val);
    setNumCarrinhos(num);
    if (num > carrinhos.length) {
      const newCarrinhos = [...carrinhos];
      for (let i = carrinhos.length + 1; i <= num; i++) {
        newCarrinhos.push(makeDefaultCarrinho(i));
      }
      setCarrinhos(newCarrinhos);
    } else if (num < carrinhos.length) {
      setCarrinhos(carrinhos.slice(0, num));
    }
  };

  const updateCarrinho = (index: number, updates: Partial<CarrinhoItem>) => {
    setCarrinhos(prev => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const toggleDay = (index: number, day: number) => {
    setCarrinhos(prev =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const dias = c.dias.includes(day) ? c.dias.filter(d => d !== day) : [...c.dias, day];
        return { ...c, dias };
      })
    );
  };

  const handleSave = () => {
    onSave({ carrinhos });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>⚙️ Configurar Carrinhos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Quantos carrinhos na semana?</Label>
            <Select value={String(numCarrinhos)} onValueChange={handleNumChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 carrinho</SelectItem>
                <SelectItem value="2">2 carrinhos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {carrinhos.map((carrinho, idx) => (
            <Card key={carrinho.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input
                    value={carrinho.label}
                    onChange={e => updateCarrinho(idx, { label: e.target.value })}
                    placeholder={`Carrinho ${idx + 1}`}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Dias da semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <label
                        key={day.value}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <Checkbox
                          checked={carrinho.dias.includes(day.value)}
                          onCheckedChange={() => toggleDay(idx, day.value)}
                        />
                        <span className="text-sm">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Horário da reunião do carrinho</Label>
                  <Input
                    type="time"
                    value={carrinho.horario_reuniao}
                    onChange={e => updateCarrinho(idx, { horario_reuniao: e.target.value, horario_corte: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Horário em que acontece a reunião do carrinho (informativo)
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
