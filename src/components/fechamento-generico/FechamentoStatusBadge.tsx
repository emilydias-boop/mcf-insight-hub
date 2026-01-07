import { Badge } from "@/components/ui/badge";
import { FECHAMENTO_STATUS_LABELS, PESSOA_STATUS_LABELS } from "@/types/fechamento-generico";

interface FechamentoStatusBadgeProps {
  status: string;
  type?: "fechamento" | "pessoa";
}

export function FechamentoStatusBadge({ status, type = "fechamento" }: FechamentoStatusBadgeProps) {
  const labels = type === "fechamento" ? FECHAMENTO_STATUS_LABELS : PESSOA_STATUS_LABELS;
  const config = labels[status] || { label: status, color: "bg-muted" };

  return (
    <Badge className={`${config.color} text-white`}>
      {config.label}
    </Badge>
  );
}
