import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Employee } from '@/types/hr';
import { EMPLOYEE_STATUS_LABELS, NFSE_STATUS_LABELS } from '@/types/hr';

type SortField = 'nome_completo' | 'cargo' | 'data_admissao' | 'status' | 'tipo_contrato';
type SortDir = 'asc' | 'desc';

interface Props {
  employees: Employee[];
  isLoading: boolean;
  nfseStatusMap: Record<string, string>;
  allEmployees: Employee[] | undefined;
  hasFilters: boolean;
  onRowClick: (e: Employee) => void;
  onEdit: (e: Employee) => void;
  onDelete: (e: Employee) => void;
}

export default function ColaboradoresTable({ employees, isLoading, nfseStatusMap, allEmployees, hasFilters, onRowClick, onEdit, onDelete }: Props) {
  const [sortField, setSortField] = useState<SortField>('nome_completo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sorted = [...employees].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const valA = a[sortField] ?? '';
    const valB = b[sortField] ?? '';
    return valA < valB ? -dir : valA > valB ? dir : 0;
  });

  const getGestorName = (gestorId: string | null) => {
    if (!gestorId) return '-';
    const g = allEmployees?.find(e => e.id === gestorId);
    return g?.nome_completo?.split(' ')[0] || '-';
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const HeaderBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort(field)}>
      {children}<SortIcon field={field} />
    </button>
  );

  const getNfseBadge = (emp: Employee) => {
    if (emp.tipo_contrato !== 'PJ') return null;
    const s = nfseStatusMap[emp.id];
    if (!s || s === 'pendente_envio') return <Badge className="bg-yellow-500 text-xs">Pendente</Badge>;
    const info = NFSE_STATUS_LABELS[s as keyof typeof NFSE_STATUS_LABELS];
    return info ? <Badge className={`${info.color} text-xs`}>{info.label}</Badge> : null;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><HeaderBtn field="nome_completo">Nome</HeaderBtn></TableHead>
              <TableHead><HeaderBtn field="cargo">Cargo</HeaderBtn></TableHead>
              <TableHead><HeaderBtn field="tipo_contrato">Vínculo</HeaderBtn></TableHead>
              <TableHead>Squad</TableHead>
              <TableHead><HeaderBtn field="data_admissao">Admissão</HeaderBtn></TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead><HeaderBtn field="status">Status</HeaderBtn></TableHead>
              <TableHead>NFSe Mês</TableHead>
              <TableHead className="w-[60px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {hasFilters ? 'Nenhum colaborador encontrado com os filtros aplicados' : 'Nenhum colaborador cadastrado'}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map(emp => (
                <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(emp)}>
                  <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                  <TableCell>{emp.cargo || '-'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{emp.tipo_contrato || '-'}</Badge></TableCell>
                  <TableCell>{emp.squad || emp.departamento || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {emp.data_admissao ? format(new Date(emp.data_admissao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </TableCell>
                  <TableCell>{getGestorName(emp.gestor_id)}</TableCell>
                  <TableCell>
                    <Badge className={EMPLOYEE_STATUS_LABELS[emp.status].color}>
                      {EMPLOYEE_STATUS_LABELS[emp.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{getNfseBadge(emp) || '-'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRowClick(emp); }}>
                          <Eye className="h-4 w-4 mr-2" /> Abrir ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(emp); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(emp); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
