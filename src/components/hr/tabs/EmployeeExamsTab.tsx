import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, TrendingUp, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEmployeeExamHistory } from '@/hooks/useExams';
import { useEmployeePdi } from '@/hooks/useEmployeePdi';
import { Employee } from '@/types/hr';
import { Progress } from '@/components/ui/progress';

interface EmployeeExamsTabProps {
  employee: Employee;
}

export default function EmployeeExamsTab({ employee }: EmployeeExamsTabProps) {
  const { data: history = [], isLoading } = useEmployeeExamHistory(employee.id);
  const { data: pdis = [], isLoading: pdiLoading } = useEmployeePdi(employee.id);

  const media = history.length > 0
    ? (history.reduce((acc, h) => acc + Number(h.nota), 0) / history.length).toFixed(1)
    : null;

  if (isLoading || pdiLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avaliações */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Avaliações</h4>
        
        {history.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma avaliação registrada.</p>
          </div>
        ) : (
          <>
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

            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{(item as any).exam?.titulo || 'Prova'}</div>
                    <div className="text-sm text-muted-foreground">
                      {(item as any).exam?.data_aplicacao
                        ? format(new Date((item as any).exam.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })
                        : '-'}
                    </div>
                    {item.observacao && (
                      <div className="text-sm text-muted-foreground mt-1 italic">"{item.observacao}"</div>
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
          </>
        )}
      </div>

      {/* PDI */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          PDI — Plano de Desenvolvimento
        </h4>

        {pdis.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum PDI registrado para este colaborador.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pdis.map((pdi) => (
              <Card key={pdi.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{pdi.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pdi.categoria} · {pdi.status === 'concluido' ? 'Concluído' : pdi.status === 'em_andamento' ? 'Em andamento' : pdi.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                      </div>
                    </div>
                    <Badge variant={pdi.status === 'concluido' ? 'default' : pdi.status === 'em_andamento' ? 'secondary' : 'outline'}>
                      {pdi.progresso}%
                    </Badge>
                  </div>
                  <Progress value={pdi.progresso} className="mt-2 h-2" />
                  {pdi.descricao && <p className="text-xs text-muted-foreground mt-2">{pdi.descricao}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Competências placeholder */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Competências</h4>
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            Módulo de competências em desenvolvimento. Em breve será possível mapear competências essenciais e do cargo.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
