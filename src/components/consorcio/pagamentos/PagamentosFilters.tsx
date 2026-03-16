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
    grupos: string[];
    responsaveis: string[];
    origens: string[];
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

        <Select value={filters.situacaoCota} onValueChange={v => set('situacaoCota', v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Situação Cota" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Situações</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_atraso">Em Atraso</SelectItem>
            <SelectItem value="quitada">Quitada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.grupo} onValueChange={v => set('grupo', v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Grupos</SelectItem>
            {options.grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.responsavel} onValueChange={v => set('responsavel', v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {options.responsaveis.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.origem} onValueChange={v => set('origem', v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Origens</SelectItem>
            {options.origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
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
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" value={filters.periodoInicio} onChange={e => set('periodoInicio', e.target.value)} className="w-[140px]" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" value={filters.periodoFim} onChange={e => set('periodoFim', e.target.value)} className="w-[140px]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={filters.apenasInadimplentes} onCheckedChange={v => set('apenasInadimplentes', v)} id="inadimplentes" />
          <Label htmlFor="inadimplentes" className="text-xs">Apenas inadimplentes</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={filters.apenasQuitadas} onCheckedChange={v => set('apenasQuitadas', v)} id="quitadas" />
          <Label htmlFor="quitadas" className="text-xs">Apenas quitadas</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={filters.apenasVencendoSemana} onCheckedChange={v => set('apenasVencendoSemana', v)} id="vencendo" />
          <Label htmlFor="vencendo" className="text-xs">Vencendo esta semana</Label>
        </div>
      </div>
    </div>
  );
}
