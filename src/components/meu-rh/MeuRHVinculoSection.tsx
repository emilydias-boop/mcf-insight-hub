import { Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Employee } from "@/types/hr";

interface MeuRHVinculoSectionProps {
  employee: Employee;
}

export function MeuRHVinculoSection({ employee }: MeuRHVinculoSectionProps) {
  const items = [
    { label: 'Tipo de contratação', value: employee.tipo_contrato || 'N/A' },
    { label: 'Jornada', value: employee.jornada_trabalho || 'Full-time' },
    { label: 'Departamento / Squad', value: employee.squad || employee.departamento || 'N/A' },
    { label: 'Local de atuação', value: 'Remoto' }, // Could be from employee.local_atuacao if added
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Resumo do vínculo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
