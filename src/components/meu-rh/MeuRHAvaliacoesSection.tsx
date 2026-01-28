import { ClipboardList, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeeExamHistory } from "@/hooks/useExams";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Employee } from "@/types/hr";

interface MeuRHAvaliacoesSectionProps {
  employee: Employee;
}

export function MeuRHAvaliacoesSection({ employee }: MeuRHAvaliacoesSectionProps) {
  const { data: history = [], isLoading } = useEmployeeExamHistory(employee.id);

  // Calcular média geral
  const media = history.length > 0
    ? (history.reduce((acc, h) => acc + Number(h.nota), 0) / history.length).toFixed(1)
    : null;

  const getNotaBadgeVariant = (nota: number): "default" | "secondary" | "destructive" => {
    if (nota >= 7) return "default";
    if (nota >= 5) return "secondary";
    return "destructive";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5" />
          Avaliações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma avaliação registrada</p>
          </div>
        ) : (
          <>
            {/* Card de Resumo */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <span className="font-medium">Média Geral</span>
                  <p className="text-sm text-muted-foreground">
                    {history.length} avaliação{history.length !== 1 ? "ões" : ""} realizada{history.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Badge
                variant={getNotaBadgeVariant(Number(media))}
                className="text-lg px-3 py-1"
              >
                {media}
              </Badge>
            </div>

            {/* Lista de Avaliações */}
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {(item as any).exam?.titulo || "Prova"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(item as any).exam?.data_aplicacao
                        ? format(new Date((item as any).exam.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </div>
                    {item.observacao && (
                      <div className="text-sm text-muted-foreground mt-1 italic">
                        "{item.observacao}"
                      </div>
                    )}
                  </div>
                  <Badge
                    variant={getNotaBadgeVariant(Number(item.nota))}
                    className="text-lg px-3 py-1"
                  >
                    {Number(item.nota).toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
