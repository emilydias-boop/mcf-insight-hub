import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEmployees, useEmployeeNfse } from '@/hooks/useEmployees';
import { Employee, EMPLOYEE_STATUS_LABELS, CARGO_OPTIONS, SQUAD_OPTIONS, NFSE_STATUS_LABELS } from '@/types/hr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Users, UserCheck, Clock, FileWarning } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmployeeDrawer from '@/components/hr/EmployeeDrawer';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Colaboradores() {
  const { data: employees, isLoading } = useEmployees();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cargoFilter, setCargoFilter] = useState<string>('all');
  const [squadFilter, setSquadFilter] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Fetch NFSe status for current month for all PJ employees
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

  // Create a map of employee_id -> nfse status
  const nfseStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    nfseData?.forEach(n => {
      map[n.employee_id] = n.status_nfse;
    });
    return map;
  }, [nfseData]);

  const filteredEmployees = useMemo(() => {
    return employees?.filter(emp => {
      const matchesSearch = emp.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
        emp.cargo?.toLowerCase().includes(search.toLowerCase()) ||
        emp.squad?.toLowerCase().includes(search.toLowerCase()) ||
        emp.departamento?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      const matchesCargo = cargoFilter === 'all' || emp.cargo === cargoFilter;
      const matchesSquad = squadFilter === 'all' || emp.squad === squadFilter;
      
      return matchesSearch && matchesStatus && matchesCargo && matchesSquad;
    }) || [];
  }, [employees, search, statusFilter, cargoFilter, squadFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = employees?.length || 0;
    const ativos = employees?.filter(e => e.status === 'ativo').length || 0;
    
    // "Em experiência" = ativos com menos de 90 dias de admissão
    const emExperiencia = employees?.filter(e => {
      if (e.status !== 'ativo' || !e.data_admissao) return false;
      const days = differenceInDays(new Date(), new Date(e.data_admissao));
      return days <= 90;
    }).length || 0;
    
    // PJ sem NFSe enviada no mês atual
    const pjEmployees = employees?.filter(e => e.tipo_contrato === 'PJ' && e.status === 'ativo') || [];
    const comNfsePendente = pjEmployees.filter(e => {
      const status = nfseStatusMap[e.id];
      return !status || status === 'pendente_envio' || status === 'devolvida';
    }).length;
    
    return { total, ativos, emExperiencia, comNfsePendente };
  }, [employees, nfseStatusMap]);

  // Get unique values for filters
  const uniqueCargos = useMemo(() => {
    const cargos = new Set(employees?.map(e => e.cargo).filter(Boolean));
    return Array.from(cargos).sort();
  }, [employees]);

  const uniqueSquads = useMemo(() => {
    const squads = new Set(employees?.map(e => e.squad).filter(Boolean));
    return Array.from(squads).sort();
  }, [employees]);

  // Find gestor name helper
  const getGestorName = (gestorId: string | null) => {
    if (!gestorId) return '-';
    const gestor = employees?.find(e => e.id === gestorId);
    return gestor?.nome_completo?.split(' ')[0] || '-';
  };

  // Get NFSe status badge for employee
  const getNfseStatusBadge = (employee: Employee) => {
    if (employee.tipo_contrato !== 'PJ') return null;
    
    const status = nfseStatusMap[employee.id];
    if (!status || status === 'pendente_envio') {
      return <Badge className="bg-yellow-500 text-xs">Pendente</Badge>;
    }
    
    const statusInfo = NFSE_STATUS_LABELS[status as keyof typeof NFSE_STATUS_LABELS];
    return statusInfo ? (
      <Badge className={`${statusInfo.color} text-xs`}>{statusInfo.label}</Badge>
    ) : null;
  };

  // Auto-open drawer from URL query param
  useEffect(() => {
    const employeeId = searchParams.get('employee');
    if (employeeId && employees && employees.length > 0) {
      const found = employees.find(e => e.id === employeeId);
      if (found) {
        setSelectedEmployee(found);
        setDrawerOpen(true);
      }
    }
  }, [searchParams, employees]);

  const handleRowClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDrawerOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground">Gestão de fichas de RH</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em Experiência</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.emExperiencia}</div>
            <p className="text-xs text-muted-foreground">≤90 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">NFSe Pendente</CardTitle>
            <FileWarning className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.comNfsePendente}</div>
            <p className="text-xs text-muted-foreground">PJ este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cargo ou squad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {Object.entries(EMPLOYEE_STATUS_LABELS).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cargoFilter} onValueChange={setCargoFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Cargos</SelectItem>
            {uniqueCargos.map((cargo) => (
              <SelectItem key={cargo} value={cargo!}>{cargo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={squadFilter} onValueChange={setSquadFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Squads</SelectItem>
            {uniqueSquads.map((squad) => (
              <SelectItem key={squad} value={squad!}>{squad}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Squad</TableHead>
                <TableHead>Gestor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>NFSe Mês</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {search || statusFilter !== 'all' || cargoFilter !== 'all' || squadFilter !== 'all'
                      ? 'Nenhum colaborador encontrado com os filtros aplicados'
                      : 'Nenhum colaborador cadastrado'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(employee)}
                  >
                    <TableCell className="font-medium">{employee.nome_completo}</TableCell>
                    <TableCell>{employee.cargo || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {employee.tipo_contrato || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>{employee.squad || employee.departamento || '-'}</TableCell>
                    <TableCell>{getGestorName(employee.gestor_id)}</TableCell>
                    <TableCell>
                      <Badge className={EMPLOYEE_STATUS_LABELS[employee.status].color}>
                        {EMPLOYEE_STATUS_LABELS[employee.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>{getNfseStatusBadge(employee) || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer */}
      <EmployeeDrawer
        employee={selectedEmployee}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Form Dialog */}
      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
