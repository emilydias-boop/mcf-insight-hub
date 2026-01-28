import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Employee, EMPLOYEE_STATUS_LABELS } from '@/types/hr';
import { useEmployees } from '@/hooks/useEmployees';
import { User, DollarSign, FileText, History, StickyNote, Calendar, Users, Shield, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmployeeGeneralTab from './tabs/EmployeeGeneralTab';
import EmployeeRemunerationTab from './tabs/EmployeeRemunerationTab';
import EmployeeNfseTab from './tabs/EmployeeNfseTab';
import EmployeeDocumentsTab from './tabs/EmployeeDocumentsTab';
import EmployeeHistoryTab from './tabs/EmployeeHistoryTab';
import EmployeeNotesTab from './tabs/EmployeeNotesTab';
import EmployeePermissionsTab from './tabs/EmployeePermissionsTab';
import EmployeeExamsTab from './tabs/EmployeeExamsTab';

interface EmployeeDrawerProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmployeeDrawer({ employee, open, onOpenChange }: EmployeeDrawerProps) {
  const { data: employees } = useEmployees();
  
  if (!employee) return null;

  // Find gestor name
  const gestor = employee.gestor_id 
    ? employees?.find(e => e.id === employee.gestor_id)
    : null;

  const isPJ = employee.tipo_contrato === 'PJ';

  // Calculate number of tabs for grid (added Avaliações tab)
  const tabCount = isPJ ? 8 : 7;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{employee.nome_completo}</SheetTitle>
              
              {/* Cargo + Status */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-muted-foreground">{employee.cargo || 'Sem cargo'}</span>
                <Badge className={EMPLOYEE_STATUS_LABELS[employee.status].color}>
                  {EMPLOYEE_STATUS_LABELS[employee.status].label}
                </Badge>
              </div>

              {/* Datas e informações adicionais */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                {employee.data_admissao && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Admissão: {format(new Date(employee.data_admissao), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                )}
                {employee.data_demissao && (
                  <div className="flex items-center gap-1 text-red-400">
                    <Calendar className="h-3 w-3" />
                    <span>Desligamento: {format(new Date(employee.data_demissao), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                )}
              </div>

              {/* Squad e Gestor */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
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
        </SheetHeader>

        <Tabs defaultValue="geral" className="mt-6">
          <TabsList className={`grid w-full grid-cols-${tabCount}`}>
            <TabsTrigger value="geral" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="remuneracao" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="hidden sm:inline">Rem.</span>
            </TabsTrigger>
            {isPJ && (
              <TabsTrigger value="nfse" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="hidden sm:inline">NFSe</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="documentos" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Docs</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1">
              <History className="h-3 w-3" />
              <span className="hidden sm:inline">Hist.</span>
            </TabsTrigger>
            <TabsTrigger value="notas" className="flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              <span className="hidden sm:inline">Notas</span>
            </TabsTrigger>
            <TabsTrigger value="permissoes" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span className="hidden sm:inline">Perm.</span>
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="flex items-center gap-1">
              <ClipboardList className="h-3 w-3" />
              <span className="hidden sm:inline">Aval.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-4">
            <EmployeeGeneralTab employee={employee} />
          </TabsContent>

          <TabsContent value="remuneracao" className="mt-4">
            <EmployeeRemunerationTab employee={employee} />
          </TabsContent>

          {isPJ && (
            <TabsContent value="nfse" className="mt-4">
              <EmployeeNfseTab employee={employee} />
            </TabsContent>
          )}

          <TabsContent value="documentos" className="mt-4">
            <EmployeeDocumentsTab employee={employee} />
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <EmployeeHistoryTab employee={employee} />
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            <EmployeeNotesTab employee={employee} />
          </TabsContent>

          <TabsContent value="permissoes" className="mt-4">
            <EmployeePermissionsTab employee={employee} />
          </TabsContent>

          <TabsContent value="avaliacoes" className="mt-4">
            <EmployeeExamsTab employee={employee} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
