import { Activity, Briefcase, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EMPLOYEE_STATUS_LABELS } from "@/types/hr";
import type { Employee } from "@/types/hr";

interface MeuRHQuickCardsProps {
  employee: Employee;
}

export function MeuRHQuickCards({ employee }: MeuRHQuickCardsProps) {
  const statusConfig = EMPLOYEE_STATUS_LABELS[employee.status] || { label: employee.status, color: 'bg-gray-500' };

  const cards = [
    {
      icon: Activity,
      label: 'Status',
      value: (
        <Badge className={`${statusConfig.color} text-white text-xs mt-1`}>
          {statusConfig.label}
        </Badge>
      ),
    },
    {
      icon: Briefcase,
      label: 'Vínculo',
      value: <span className="text-sm font-semibold">{employee.tipo_contrato || 'N/A'}</span>,
    },
    {
      icon: Clock,
      label: 'Jornada',
      value: <span className="text-sm font-semibold">{employee.jornada_trabalho || 'Full-time'}</span>,
    },
    {
      icon: MapPin,
      label: 'Local de atuação',
      value: <span className="text-sm font-semibold">Remoto</span>,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/60">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <card.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{card.label}</p>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
