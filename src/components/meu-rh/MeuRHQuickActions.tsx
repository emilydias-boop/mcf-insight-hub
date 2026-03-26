import { FileUp, MessageSquarePlus, FolderOpen, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Employee } from "@/types/hr";

interface MeuRHQuickActionsProps {
  employee: Employee;
  onTabChange: (tab: string) => void;
}

export function MeuRHQuickActions({ employee, onTabChange }: MeuRHQuickActionsProps) {
  const actions = [
    ...(employee.tipo_contrato === 'PJ'
      ? [{
          icon: FileUp,
          label: 'Enviar NFSe',
          tab: 'perfil',
        }]
      : []),
    {
      icon: MessageSquarePlus,
      label: 'Abrir Solicitação',
      tab: 'fale-rh',
    },
    {
      icon: FolderOpen,
      label: 'Ver Documentos',
      tab: 'documentos',
    },
    {
      icon: Target,
      label: 'Ver PDI',
      tab: 'pdi',
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onTabChange(action.tab)}
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
