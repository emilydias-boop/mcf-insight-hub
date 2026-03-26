import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEmployees } from '@/hooks/useEmployees';
import { Employee } from '@/types/hr';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeMutations } from '@/hooks/useEmployees';
import EmployeeDrawer from '@/components/hr/EmployeeDrawer';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import ColaboradoresStatsCards from '@/components/hr/ColaboradoresStatsCards';
import ColaboradoresToolbar from '@/components/hr/ColaboradoresToolbar';
import ColaboradoresFilters from '@/components/hr/ColaboradoresFilters';
import ColaboradoresTable from '@/components/hr/ColaboradoresTable';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Colaboradores() {
  const { data: employees, isLoading } = useEmployees();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: '', status: 'all', cargo: 'all', squad: 'all',
    tipoContrato: 'all', gestor: 'all', departamento: 'all',
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const { deleteEmployee } = useEmployeeMutations();

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const { data: nfseData } = useQuery({
    queryKey: ['all-nfse-current-month', currentYear, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_nfse')
        .select('employee_id, status_nfse')
        .eq('ano', currentYear)
        .eq('mes', currentMonth);
      if (error) throw error;
      return data;
    },
  });

  const nfseStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    nfseData?.forEach(n => { map[n.employee_id] = n.status_nfse; });
    return map;
  }, [nfseData]);

  const updateFilters = (partial: Partial<typeof filters>) => setFilters(f => ({ ...f, ...partial }));

  const uniqueCargos = useMemo(() => {
    return Array.from(new Set(employees?.map(e => e.cargo).filter(Boolean) as string[])).sort();
  }, [employees]);

  const uniqueSquads = useMemo(() => {
    return Array.from(new Set(employees?.map(e => e.squad).filter(Boolean) as string[])).sort();
  }, [employees]);

  const uniqueGestores = useMemo(() => {
    const ids = new Set(employees?.map(e => e.gestor_id).filter(Boolean) as string[]);
    return Array.from(ids).map(id => {
      const g = employees?.find(e => e.id === id);
      return { id, nome: g?.nome_completo?.split(' ').slice(0, 2).join(' ') || id };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees?.filter(emp => {
      const s = filters.search.toLowerCase();
      const matchSearch = !s || emp.nome_completo.toLowerCase().includes(s) ||
        emp.cargo?.toLowerCase().includes(s) || emp.squad?.toLowerCase().includes(s) ||
        emp.departamento?.toLowerCase().includes(s);
      const matchStatus = filters.status === 'all' || emp.status === filters.status;
      const matchCargo = filters.cargo === 'all' || emp.cargo === filters.cargo;
      const matchSquad = filters.squad === 'all' || emp.squad === filters.squad;
      const matchTipo = filters.tipoContrato === 'all' || emp.tipo_contrato === filters.tipoContrato;
      const matchGestor = filters.gestor === 'all' || emp.gestor_id === filters.gestor;
      const matchDepto = filters.departamento === 'all' || emp.departamento === filters.departamento;
      return matchSearch && matchStatus && matchCargo && matchSquad && matchTipo && matchGestor && matchDepto;
    }) || [];
  }, [employees, filters]);

  const hasFilters = filters.search !== '' || filters.status !== 'all' || filters.cargo !== 'all' ||
    filters.squad !== 'all' || filters.tipoContrato !== 'all' || filters.gestor !== 'all' || filters.departamento !== 'all';

  useEffect(() => {
    const employeeId = searchParams.get('employee');
    if (employeeId && employees?.length) {
      const found = employees.find(e => e.id === employeeId);
      if (found) { setSelectedEmployee(found); setDrawerOpen(true); }
    }
  }, [searchParams, employees]);

  const handleRowClick = (emp: Employee) => { setSelectedEmployee(emp); setDrawerOpen(true); };
  const handleEdit = (emp: Employee) => { setEditEmployee(emp); setFormOpen(true); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground">Central administrativa de gestão de pessoas</p>
        </div>
        <ColaboradoresToolbar onNewEmployee={() => { setEditEmployee(null); setFormOpen(true); }} filteredEmployees={filteredEmployees} />
      </div>

      <ColaboradoresStatsCards employees={employees} nfseStatusMap={nfseStatusMap} />

      <ColaboradoresFilters
        filters={filters}
        onChange={updateFilters}
        uniqueCargos={uniqueCargos}
        uniqueSquads={uniqueSquads}
        uniqueGestores={uniqueGestores}
        resultCount={filteredEmployees.length}
        totalCount={employees?.length || 0}
      />

      <ColaboradoresTable
        employees={filteredEmployees}
        isLoading={isLoading}
        nfseStatusMap={nfseStatusMap}
        allEmployees={employees}
        hasFilters={hasFilters}
        onRowClick={handleRowClick}
        onEdit={handleEdit}
        onDelete={setEmployeeToDelete}
      />

      <EmployeeDrawer employee={selectedEmployee} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{employeeToDelete?.nome_completo}</strong>?
              Todos os documentos, eventos, notas e NFSe associados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (employeeToDelete) { deleteEmployee.mutate(employeeToDelete.id); setEmployeeToDelete(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
