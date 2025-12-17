import { DollarSign, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnPayout, useOwnSdr, useSdrCompPlan } from "@/hooks/useSdrFechamento";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Employee } from "@/types/hr";

interface MeuRHRemuneracaoSectionProps {
  employee: Employee;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-yellow-500' },
  PENDING: { label: 'Em validação', color: 'bg-blue-500' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-500' },
  LOCKED: { label: 'Fechado', color: 'bg-gray-500' },
};

export function MeuRHRemuneracaoSection({ employee }: MeuRHRemuneracaoSectionProps) {
  const navigate = useNavigate();
  
  // Current month in YYYY-MM format
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthDisplay = format(new Date(), 'MMMM yyyy', { locale: ptBR });
  
  const { data: sdr, isLoading: sdrLoading } = useOwnSdr();
  const { data: payout, isLoading: payoutLoading } = useOwnPayout(currentMonth);
  const { data: compPlan, isLoading: compPlanLoading } = useSdrCompPlan(sdr?.id, currentMonth);

  const isLoading = sdrLoading || payoutLoading || compPlanLoading;

  // If no SDR record linked, show fallback with employee OTE
  if (!sdrLoading && !sdr) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Remuneração
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">OTE Mensal</p>
              <p className="text-lg font-semibold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(employee.ote_mensal || 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Salário Base</p>
              <p className="text-lg font-semibold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(employee.salario_base || 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Nível</p>
              <p className="text-lg font-semibold">{employee.nivel || 1}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tipo</p>
              <p className="text-sm font-medium">{employee.tipo_variavel || 'N/A'}</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-4">
            Seu modelo de remuneração não está vinculado ao fechamento SDR.
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = STATUS_LABELS[payout?.status || 'DRAFT'] || STATUS_LABELS.DRAFT;
  const formatCurrency = (value: number | null | undefined) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Remuneração do mês atual
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate('/fechamento-sdr/meu-fechamento')}
          >
            Ver detalhes
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Month title and status */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground capitalize">
                Fechamento de {monthDisplay}
              </p>
              <Badge className={`${statusConfig.color} text-white text-[10px]`}>
                {statusConfig.label}
              </Badge>
            </div>

            {/* Values grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 p-3 rounded-md bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">OTE Total</p>
                <p className="text-lg font-semibold">
                  {formatCurrency((compPlan?.fixo_valor || 0) + (compPlan?.valor_meta_rpg || 0) + (compPlan?.valor_docs_reuniao || 0) + (compPlan?.valor_tentativas || 0) + (compPlan?.valor_organizacao || 0))}
                </p>
              </div>
              <div className="space-y-1 p-3 rounded-md bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fixo</p>
                <p className="text-lg font-semibold">{formatCurrency(payout?.valor_fixo || compPlan?.fixo_valor)}</p>
              </div>
              <div className="space-y-1 p-3 rounded-md bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Variável</p>
                <p className="text-lg font-semibold">{formatCurrency(payout?.valor_variavel_total)}</p>
              </div>
              <div className="space-y-1 p-3 rounded-md bg-primary/10 border border-primary/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(payout?.total_conta)}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
