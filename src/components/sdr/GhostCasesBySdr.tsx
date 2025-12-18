import { Link } from "react-router-dom";
import { Ghost, AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGhostAuditList, GHOST_TYPE_LABELS, SEVERITY_LABELS } from "@/hooks/useGhostAppointments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GhostCasesBySdrProps {
  sdrEmail: string;
  sdrName?: string;
}

export function GhostCasesBySdr({ sdrEmail, sdrName }: GhostCasesBySdrProps) {
  const { data: cases, isLoading } = useGhostAuditList({
    sdr_email: sdrEmail,
    status: 'pending',
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cases || cases.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Ghost className="h-5 w-5 text-amber-400" />
          Casos Suspeitos
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 ml-2">
            {cases.length} pendente{cases.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cases.slice(0, 5).map((caseItem) => (
          <div
            key={caseItem.id}
            className="p-3 rounded-lg bg-muted/50 border border-border flex flex-col sm:flex-row sm:items-center gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={
                    caseItem.severity === 'critical'
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : caseItem.severity === 'high'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  }
                >
                  {SEVERITY_LABELS[caseItem.severity] || caseItem.severity}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {GHOST_TYPE_LABELS[caseItem.ghost_type] || caseItem.ghost_type}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {caseItem.contact_name || 'Contato desconhecido'}
              </p>
              <p className="text-xs text-muted-foreground">
                {caseItem.total_r1_agendada} agendamento{caseItem.total_r1_agendada !== 1 ? 's' : ''} em {caseItem.distinct_days} dia{caseItem.distinct_days !== 1 ? 's' : ''}
                {caseItem.no_show_count > 0 && ` • ${caseItem.no_show_count} no-show${caseItem.no_show_count !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {caseItem.first_r1_date && format(new Date(caseItem.first_r1_date), "dd/MM", { locale: ptBR })}
              {caseItem.last_r1_date && caseItem.first_r1_date !== caseItem.last_r1_date && (
                <> - {format(new Date(caseItem.last_r1_date), "dd/MM", { locale: ptBR })}</>
              )}
            </div>
          </div>
        ))}

        {cases.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            + {cases.length - 5} outro{cases.length - 5 !== 1 ? 's' : ''} caso{cases.length - 5 !== 1 ? 's' : ''}
          </p>
        )}

        <Button variant="outline" size="sm" asChild className="w-full mt-2">
          <Link to={`/crm/auditoria-agendamentos?sdr=${encodeURIComponent(sdrEmail)}`}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Ver todos na auditoria
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
