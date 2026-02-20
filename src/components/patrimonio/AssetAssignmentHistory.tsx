import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AssetAssignmentWithDetails } from '@/types/patrimonio';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users } from 'lucide-react';

interface AssetAssignmentHistoryProps {
  assignments: AssetAssignmentWithDetails[];
  isLoading?: boolean;
}

export const AssetAssignmentHistory = ({ assignments, isLoading }: AssetAssignmentHistoryProps) => {
  const pastAssignments = assignments.filter(a => a.status === 'devolvido' || a.status === 'transferido');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Responsáveis Anteriores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          Responsáveis Anteriores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pastAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhum responsável anterior
          </p>
        ) : (
          <div className="space-y-3">
            {pastAssignments.map(a => (
              <div key={a.id} className="p-3 rounded-lg border space-y-1">
                <div className="font-medium text-sm">
                  {a.employee?.nome_completo || 'Colaborador'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.setor && <span>{a.setor}</span>}
                  {a.setor && a.cargo && <span> · </span>}
                  {a.cargo && <span>{a.cargo}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(a.data_liberacao), 'dd/MM/yyyy', { locale: ptBR })}
                  {' → '}
                  {a.data_devolucao_real
                    ? format(new Date(a.data_devolucao_real), 'dd/MM/yyyy', { locale: ptBR })
                    : '—'}
                </div>
                <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-muted capitalize">
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
