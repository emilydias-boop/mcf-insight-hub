import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEmployeeExamHistory } from '@/hooks/useExams';
import { Employee } from '@/types/hr';

interface EmployeeExamsTabProps {
  employee: Employee;
}

export default function EmployeeExamsTab({ employee }: EmployeeExamsTabProps) {
  const { data: history = [], isLoading } = useEmployeeExamHistory(employee.id);

  // Calcular média geral
  const media = history.length > 0
    ? (history.reduce((acc, h) => acc + Number(h.nota), 0) / history.length).toFixed(1)
    : null;

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando avaliações...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhuma avaliação registrada para este colaborador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium">Média Geral</span>
            </div>
            <Badge
              variant={Number(media) >= 7 ? 'default' : Number(media) >= 5 ? 'secondary' : 'destructive'}
              className="text-lg px-3 py-1"
            >
              {media}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {history.length} avaliação{history.length !== 1 ? 'ões' : ''} realizada{history.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Histórico */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Histórico de Avaliações
        </h4>
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium">
                {(item as any).exam?.titulo || 'Prova'}
              </div>
              <div className="text-sm text-muted-foreground">
                {(item as any).exam?.data_aplicacao
                  ? format(new Date((item as any).exam.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })
                  : '-'}
              </div>
              {item.observacao && (
                <div className="text-sm text-muted-foreground mt-1 italic">
                  "{item.observacao}"
                </div>
              )}
            </div>
            <Badge
              variant={Number(item.nota) >= 7 ? 'default' : Number(item.nota) >= 5 ? 'secondary' : 'destructive'}
              className="text-lg px-3 py-1"
            >
              {Number(item.nota).toFixed(1)}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
