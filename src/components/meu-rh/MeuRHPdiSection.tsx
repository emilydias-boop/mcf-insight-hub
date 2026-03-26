import { useState } from "react";
import { Target, ChevronDown, ChevronUp, Send, Calendar, TrendingUp, Award, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Employee } from "@/types/hr";
import {
  useMyPdis,
  useMyPdiComments,
  useAddPdiComment,
  PDI_STATUS_LABELS,
  PDI_CATEGORIA_LABELS,
  PDI_PRIORIDADE_LABELS,
  type EmployeePdi,
} from "@/hooks/useEmployeePdi";

function PdiComments({ pdiId, employeeName }: { pdiId: string; employeeName: string }) {
  const { data: comments, isLoading } = useMyPdiComments(pdiId);
  const addComment = useAddPdiComment();
  const [newComment, setNewComment] = useState("");

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addComment.mutate(
      { pdiId, conteudo: newComment.trim(), autorNome: employeeName },
      { onSuccess: () => setNewComment("") }
    );
  };

  if (isLoading) return <Skeleton className="h-20" />;

  const autorTypeLabels: Record<string, { label: string; color: string }> = {
    colaborador: { label: "Você", color: "bg-blue-100 text-blue-800" },
    gestor: { label: "Gestor", color: "bg-purple-100 text-purple-800" },
    rh: { label: "RH", color: "bg-green-100 text-green-800" },
  };

  return (
    <div className="space-y-3 mt-3 pt-3 border-t">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <MessageSquare className="h-3 w-3" /> Comentários
      </p>

      {comments && comments.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map((c) => {
            const autorInfo = autorTypeLabels[c.autor_tipo] || autorTypeLabels.rh;
            return (
              <div key={c.id} className="bg-muted/50 rounded-md p-2.5 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${autorInfo.color}`}>
                    {autorInfo.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.autor_nome} · {format(new Date(c.created_at), "dd/MM/yy HH:mm")}
                  </span>
                </div>
                <p className="text-sm">{c.conteudo}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nenhum comentário ainda.</p>
      )}

      <div className="flex gap-2">
        <Textarea
          placeholder="Adicionar atualização ou comentário..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[60px] text-sm"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
          className="shrink-0 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PdiCard({ pdi, employeeName }: { pdi: EmployeePdi; employeeName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const statusInfo = PDI_STATUS_LABELS[pdi.status];
  const categoriaInfo = PDI_CATEGORIA_LABELS[pdi.categoria];
  const prioridadeInfo = PDI_PRIORIDADE_LABELS[pdi.prioridade];

  const progressColor =
    pdi.progresso >= 80 ? "bg-green-500" :
    pdi.progresso >= 40 ? "bg-yellow-500" :
    "bg-blue-500";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="transition-shadow hover:shadow-md">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${statusInfo.color} text-white text-[10px]`}>{statusInfo.label}</Badge>
                  <Badge variant="outline" className="text-[10px]">{categoriaInfo.label}</Badge>
                  {pdi.prioridade === 'alta' && (
                    <Badge className={`${prioridadeInfo.color} text-white text-[10px]`}>
                      {prioridadeInfo.label}
                    </Badge>
                  )}
                </div>
                <h4 className="font-medium text-sm leading-tight">{pdi.titulo}</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Progress value={pdi.progresso} className="h-2" indicatorClassName={progressColor} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {pdi.progresso}%
                  </span>
                </div>
                {pdi.data_prevista && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Prazo: {format(new Date(pdi.data_prevista + 'T12:00:00'), "dd/MM/yyyy")}
                  </p>
                )}
              </div>
              <div className="shrink-0 pt-1">
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            {pdi.descricao && (
              <p className="text-sm text-muted-foreground mb-2">{pdi.descricao}</p>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
              {pdi.data_inicio && (
                <span>Início: {format(new Date(pdi.data_inicio + 'T12:00:00'), "dd/MM/yyyy")}</span>
              )}
              {pdi.data_conclusao && (
                <span>Concluído em: {format(new Date(pdi.data_conclusao + 'T12:00:00'), "dd/MM/yyyy")}</span>
              )}
            </div>
            <PdiComments pdiId={pdi.id} employeeName={employeeName} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function MeuRHPdiSection({ employee }: { employee: Employee }) {
  const { data: pdis, isLoading } = useMyPdis(employee.id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!pdis || pdis.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-muted mb-4">
            <Target className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Seu PDI ainda não foi criado</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Em breve seu gestor ou o RH criará seu Plano de Desenvolvimento Individual com metas, competências e trilha de evolução.
          </p>
        </CardContent>
      </Card>
    );
  }

  const total = pdis.length;
  const emAndamento = pdis.filter(p => p.status === 'em_andamento').length;
  const concluidos = pdis.filter(p => p.status === 'concluido').length;
  const progressoGeral = Math.round(pdis.reduce((acc, p) => acc + p.progresso, 0) / total);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <div>
              <p className="text-lg font-bold">{total}</p>
              <p className="text-[11px] text-muted-foreground">Total de Metas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="text-lg font-bold">{emAndamento}</p>
              <p className="text-[11px] text-muted-foreground">Em Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-lg font-bold">{concluidos}</p>
              <p className="text-[11px] text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] text-muted-foreground">Progresso Geral</p>
              <p className="text-sm font-bold">{progressoGeral}%</p>
            </div>
            <Progress
              value={progressoGeral}
              className="h-2"
              indicatorClassName={progressoGeral >= 80 ? "bg-green-500" : progressoGeral >= 40 ? "bg-yellow-500" : "bg-blue-500"}
            />
          </CardContent>
        </Card>
      </div>

      {/* PDI Cards */}
      <div className="space-y-3">
        {pdis.map((pdi) => (
          <PdiCard key={pdi.id} pdi={pdi} employeeName={employee.nome_completo} />
        ))}
      </div>
    </div>
  );
}
