import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Employee, EMPLOYEE_STATUS_LABELS } from '@/types/hr';
import { User, DollarSign, FileText, History, StickyNote } from 'lucide-react';
import EmployeeGeneralTab from './tabs/EmployeeGeneralTab';
import EmployeeRemunerationTab from './tabs/EmployeeRemunerationTab';
import EmployeeDocumentsTab from './tabs/EmployeeDocumentsTab';
import EmployeeHistoryTab from './tabs/EmployeeHistoryTab';
import EmployeeNotesTab from './tabs/EmployeeNotesTab';

interface EmployeeDrawerProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmployeeDrawer({ employee, open, onOpenChange }: EmployeeDrawerProps) {
  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-xl">{employee.nome_completo}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{employee.cargo || 'Sem cargo'}</span>
                <Badge className={EMPLOYEE_STATUS_LABELS[employee.status].color}>
                  {EMPLOYEE_STATUS_LABELS[employee.status].label}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="geral" className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="geral" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="remuneracao" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="hidden sm:inline">Remuneração</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1">
              <History className="h-3 w-3" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
            <TabsTrigger value="notas" className="flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              <span className="hidden sm:inline">Notas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-4">
            <EmployeeGeneralTab employee={employee} />
          </TabsContent>

          <TabsContent value="remuneracao" className="mt-4">
            <EmployeeRemunerationTab employee={employee} />
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <EmployeeDocumentsTab employee={employee} />
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <EmployeeHistoryTab employee={employee} />
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            <EmployeeNotesTab employee={employee} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
