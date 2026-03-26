import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { EMPLOYEE_STATUS_LABELS, TIPO_VINCULO_OPTIONS, DEPARTAMENTO_OPTIONS } from '@/types/hr';

interface Filters {
  search: string;
  status: string;
  cargo: string;
  squad: string;
  tipoContrato: string;
  gestor: string;
  departamento: string;
}

interface Props {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  uniqueCargos: string[];
  uniqueSquads: string[];
  uniqueGestores: { id: string; nome: string }[];
  resultCount: number;
  totalCount: number;
}

export default function ColaboradoresFilters({ filters, onChange, uniqueCargos, uniqueSquads, uniqueGestores, resultCount, totalCount }: Props) {
  const hasActiveFilter = filters.search || filters.status !== 'all' || filters.cargo !== 'all' || filters.squad !== 'all' || filters.tipoContrato !== 'all' || filters.gestor !== 'all' || filters.departamento !== 'all';

  const clearAll = () => onChange({ search: '', status: 'all', cargo: 'all', squad: 'all', tipoContrato: 'all', gestor: 'all', departamento: 'all' });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cargo ou squad..."
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        <Select value={filters.status} onValueChange={v => onChange({ status: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {Object.entries(EMPLOYEE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.cargo} onValueChange={v => onChange({ cargo: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Cargos</SelectItem>
            {uniqueCargos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.squad} onValueChange={v => onChange({ squad: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Squad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Squads</SelectItem>
            {uniqueSquads.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.tipoContrato} onValueChange={v => onChange({ tipoContrato: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Vínculo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Vínculos</SelectItem>
            {TIPO_VINCULO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.departamento} onValueChange={v => onChange({ departamento: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Deptos</SelectItem>
            {DEPARTAMENTO_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.gestor} onValueChange={v => onChange({ gestor: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Gestor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Gestores</SelectItem>
            {uniqueGestores.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Mostrando {resultCount} de {totalCount} colaboradores</span>
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
            <X className="h-3 w-3 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
