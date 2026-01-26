import { useMemo, useState } from 'react';
import { useCargos } from '@/hooks/useOrganograma';
import { CargoCatalogo } from '@/types/organograma';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CargoSelectProps {
  cargoId: string | null;
  cargoTexto: string | null;
  onChange: (cargoId: string | null, cargoTexto: string | null) => void;
  disabled?: boolean;
  showInfo?: boolean;
}

export default function CargoSelect({ cargoId, cargoTexto, onChange, disabled = false, showInfo = true }: CargoSelectProps) {
  const { data: cargos, isLoading } = useCargos();
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Agrupar cargos por área
  const cargosByArea = useMemo(() => {
    if (!cargos) return {};
    return cargos.reduce((acc, cargo) => {
      const area = cargo.area || 'Outros';
      if (!acc[area]) acc[area] = [];
      acc[area].push(cargo);
      return acc;
    }, {} as Record<string, CargoCatalogo[]>);
  }, [cargos]);

  // Determinar o valor selecionado
  const selectedValue = useMemo(() => {
    if (showCustomInput) return '_outro';
    if (cargoId) return cargoId;
    // Se tem texto mas não tem ID, verificar se é um cargo customizado
    if (cargoTexto && !cargoId) {
      const matchedCargo = cargos?.find(c => c.nome_exibicao === cargoTexto || c.cargo_base === cargoTexto);
      if (matchedCargo) return matchedCargo.id;
      return '_outro';
    }
    return '_none';
  }, [cargoId, cargoTexto, cargos, showCustomInput]);

  // Cargo selecionado para exibir informações
  const selectedCargo = useMemo(() => {
    if (!cargoId || !cargos) return null;
    return cargos.find(c => c.id === cargoId) || null;
  }, [cargoId, cargos]);

  const handleValueChange = (value: string) => {
    if (value === '_none') {
      setShowCustomInput(false);
      onChange(null, null);
    } else if (value === '_outro') {
      setShowCustomInput(true);
      onChange(null, cargoTexto || '');
    } else {
      setShowCustomInput(false);
      const cargo = cargos?.find(c => c.id === value);
      if (cargo) {
        // Preenche cargo_catalogo_id e cargo (texto) com o cargo_base para compatibilidade
        onChange(cargo.id, cargo.cargo_base);
      }
    }
  };

  const handleCustomInputChange = (value: string) => {
    onChange(null, value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Ordenar áreas
  const sortedAreas = useMemo(() => {
    return Object.keys(cargosByArea).sort((a, b) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return a.localeCompare(b);
    });
  }, [cargosByArea]);

  return (
    <div className="space-y-2">
      <Select
        value={selectedValue}
        onValueChange={handleValueChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione o cargo"} />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value="_none">Selecione...</SelectItem>
          
          {sortedAreas.map((area) => (
            <SelectGroup key={area}>
              <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {area}
              </SelectLabel>
              {cargosByArea[area].map((cargo) => (
                <SelectItem key={cargo.id} value={cargo.id}>
                  <div className="flex items-center gap-2">
                    <span>{cargo.nome_exibicao}</span>
                    {cargo.ote_total > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        OTE {formatCurrency(cargo.ote_total)}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          
          <SelectSeparator />
          <SelectItem value="_outro">
            <span className="text-muted-foreground">Outro (texto livre)</span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Input customizado quando "Outro" é selecionado */}
      {showCustomInput && (
        <Input
          value={cargoTexto || ''}
          onChange={(e) => handleCustomInputChange(e.target.value)}
          placeholder="Digite o cargo..."
          disabled={disabled}
          className="mt-2"
        />
      )}

      {/* Info card quando cargo do catálogo está selecionado */}
      {showInfo && selectedCargo && (
        <div className="mt-2 p-2 bg-muted rounded-md text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cargo Base:</span>
            <span className="font-medium">{selectedCargo.cargo_base}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Área:</span>
            <span className="font-medium">{selectedCargo.area}</span>
          </div>
          {selectedCargo.nivel && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nível:</span>
              <span className="font-medium">{selectedCargo.nivel}</span>
            </div>
          )}
          {selectedCargo.fixo_valor > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fixo:</span>
              <span className="font-medium">{formatCurrency(selectedCargo.fixo_valor)}</span>
            </div>
          )}
          {selectedCargo.ote_total > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>OTE Total:</span>
              <span className="font-medium">{formatCurrency(selectedCargo.ote_total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
