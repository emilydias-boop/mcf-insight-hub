import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EMPLOYEE_STATUS_LABELS } from '@/types/hr';
import { ArrowLeft, Pencil, User, Calendar, Users, DollarSign, FileText, History, StickyNote, Shield, ClipboardList, Clock, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import EmployeeGeneralTab from '@/components/hr/tabs/EmployeeGeneralTab';
import EmployeeRemunerationTab from '@/components/hr/tabs/EmployeeRemunerationTab';
import EmployeeNfseTab from '@/components/hr/tabs/EmployeeNfseTab';
import EmployeeDocumentsTab from '@/components/hr/tabs/EmployeeDocumentsTab';
import EmployeeHistoryTab from '@/components/hr/tabs/EmployeeHistoryTab';
import EmployeeNotesTab from '@/components/hr/tabs/EmployeeNotesTab';
import EmployeePermissionsTab from '@/components/hr/tabs/EmployeePermissionsTab';
import EmployeeExamsTab from '@/components/hr/tabs/EmployeeExamsTab';
import EmployeeTimeTab from '@/components/hr/tabs/EmployeeTimeTab';
import EmployeeComplianceTab from '@/components/hr/tabs/EmployeeComplianceTab';

export default function ColaboradorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: employees, isLoading } = useEmployees();
  const { session } = useAuth();
  const [formOpen, setFormOpen] = useState(false);

  const employee = employees?.find(e => e.id === id);
  const gestor = employee?.gestor_id ? employees?.find(e => e.id === employee.gestor_id) : null;
  const isPJ = employee?.tipo_contrato === 'PJ';

  const jwtClaims = (session as any)?.user?.app_metadata || {};
  const userRole = (session?.user as any)?.user_metadata?.role || '';
  const effectiveRole = jwtClaims.user_role || userRole;
  const canSeeCompliance = ['admin', 'manager', 'rh'].includes(effectiveRole?.toLowerCase?.() || '');

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate('/rh/colaboradores')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-muted-foreground">Colaborador não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/rh/colaboradores')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <span className="text-sm text-muted-foreground">Colaborador</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{employee.nome_completo}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">{employee.cargo || 'Sem cargo'}</span>
              <Badge className={EMPLOYEE_STATUS_LABELS[employee.status].color}>
                {EMPLOYEE_STATUS_LABELS[employee.status].label}
              </Badge>
              {employee.tipo_contrato && (
                <Badge variant="outline">{employee.tipo_contrato}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {employee.data_admissao && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Admissão: {format(new Date(employee.data_admissao), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              )}
              {employee.data_demissao && (
                <span className="flex items-center gap-1 text-destructive">
                  <Calendar className="h-3.5 w-3.5" />
                  Desligamento: {format(new Date(employee.data_demissao), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {employee.squad && (
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {employee.squad}
                </Badge>
              )}
              {gestor && (
                <Badge variant="secondary" className="text-xs">
                  Gestor: {gestor.nome_completo}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="geral" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Geral
          </TabsTrigger>
          <TabsTrigger value="remuneracao" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Remuneração
          </TabsTrigger>
          {isPJ && (
            <TabsTrigger value="nfse" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> NFSe
            </TabsTrigger>
          )}
          <TabsTrigger value="documentos" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Desempenho
          </TabsTrigger>
          <TabsTrigger value="tempo" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Gestão de Tempo
          </TabsTrigger>
          {canSeeCompliance && (
            <TabsTrigger value="compliance" className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> Compliance
            </TabsTrigger>
          )}
          <TabsTrigger value="notas" className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" /> Notas
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Permissões
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Avaliações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <EmployeeGeneralTab employee={employee} />
        </TabsContent>
        <TabsContent value="remuneracao" className="mt-6">
          <EmployeeRemunerationTab employee={employee} />
        </TabsContent>
        {isPJ && (
          <TabsContent value="nfse" className="mt-6">
            <EmployeeNfseTab employee={employee} />
          </TabsContent>
        )}
        <TabsContent value="documentos" className="mt-6">
          <EmployeeDocumentsTab employee={employee} />
        </TabsContent>
        <TabsContent value="historico" className="mt-6">
          <EmployeeHistoryTab employee={employee} />
        </TabsContent>
        <TabsContent value="tempo" className="mt-6">
          <EmployeeTimeTab employee={employee} />
        </TabsContent>
        {canSeeCompliance && (
          <TabsContent value="compliance" className="mt-6">
            <EmployeeComplianceTab employee={employee} />
          </TabsContent>
        )}
        <TabsContent value="notas" className="mt-6">
          <EmployeeNotesTab employee={employee} />
        </TabsContent>
        <TabsContent value="permissoes" className="mt-6">
          <EmployeePermissionsTab employee={employee} />
        </TabsContent>
        <TabsContent value="avaliacoes" className="mt-6">
          <EmployeeExamsTab employee={employee} />
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
