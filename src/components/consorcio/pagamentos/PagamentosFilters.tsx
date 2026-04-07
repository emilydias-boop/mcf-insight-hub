import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { PagamentosFiltersState } from '@/hooks/useConsorcioPagamentos';

interface Props {
  filters: PagamentosFiltersState;
  onChange: (f: PagamentosFiltersState) => void;
  options: {
    diasVencimento: number[];
  };
}

export function PagamentosFilters({ filters, onChange, options }: Props) {
  const set = (key: keyof PagamentosFiltersState, value: any) => onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, grupo, cota..."
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filters.statusParcela} onValueChange={v => set('statusParcela', v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="vencendo">Vencendo</SelectItem>
            <SelectItem value="atrasada">Atrasada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.diaVencimento} onValueChange={v => set('diaVencimento', v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Dia Vencimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Dias</SelectItem>
            {options.diasVencimento.map(d => (
              <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.tipo} onValueChange={v => set('tipo', v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Tipos</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
            <SelectItem value="empresa">Empresa</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch checked={filters.apenasVencendoSemana} onCheckedChange={v => set('apenasVencendoSemana', v)} id="vencendo" />
          <Label htmlFor="vencendo" className="text-xs">Vencendo esta semana</Label>
        </div>
      </div>
    </div>
  );
}
