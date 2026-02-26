import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useUpdateManualPayout } from "@/hooks/useSdrKpiMutations";
import { SdrMonthPayout } from "@/types/sdr-fechamento";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ManualPayoutFormProps {
  payout: SdrMonthPayout;
  disabled?: boolean;
}

export const ManualPayoutForm = ({ payout, disabled }: ManualPayoutFormProps) => {
  const updateManualPayout = useUpdateManualPayout();

  const [valorFixo, setValorFixo] = useState(payout.valor_fixo || 0);
  const [valorVariavel, setValorVariavel] = useState(payout.valor_variavel_total || 0);
  const [ifoodMensal, setIfoodMensal] = useState(payout.ifood_mensal || 0);
  const [ifoodUltrameta, setIfoodUltrameta] = useState(payout.ifood_ultrameta || 0);

  // Sync when payout data changes from server
  useEffect(() => {
    setValorFixo(payout.valor_fixo || 0);
    setValorVariavel(payout.valor_variavel_total || 0);
    setIfoodMensal(payout.ifood_mensal || 0);
    setIfoodUltrameta(payout.ifood_ultrameta || 0);
  }, [payout.valor_fixo, payout.valor_variavel_total, payout.ifood_mensal, payout.ifood_ultrameta]);

  const totalConta = valorFixo + valorVariavel;
  const totalIfood = ifoodMensal + ifoodUltrameta;

  const handleSave = () => {
    updateManualPayout.mutate({
      payoutId: payout.id,
      sdrId: payout.sdr_id,
      anoMes: payout.ano_mes,
      data: {
        valor_fixo: valorFixo,
        valor_variavel_total: valorVariavel,
        total_conta: totalConta,
        ifood_mensal: ifoodMensal,
        ifood_ultrameta: ifoodUltrameta,
        total_ifood: totalIfood,
      },
    });
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Save className="h-4 w-4" />
          Valores do Payout (Manual)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <Alert variant="default" className="border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-xs text-muted-foreground">
            Fechamento manual ativo. Preencha os valores diretamente — o cálculo automático está desativado.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor Fixo</Label>
            <Input
              type="number"
              step="0.01"
              value={valorFixo}
              onChange={(e) => setValorFixo(Number(e.target.value))}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor Variável</Label>
            <Input
              type="number"
              step="0.01"
              value={valorVariavel}
              onChange={(e) => setValorVariavel(Number(e.target.value))}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">iFood Mensal</Label>
            <Input
              type="number"
              step="0.01"
              value={ifoodMensal}
              onChange={(e) => setIfoodMensal(Number(e.target.value))}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">iFood Ultrameta</Label>
            <Input
              type="number"
              step="0.01"
              value={ifoodUltrameta}
              onChange={(e) => setIfoodUltrameta(Number(e.target.value))}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Total Conta:</span>{" "}
            <span className="font-bold text-primary">{formatCurrency(totalConta)}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Total iFood:</span>{" "}
            <span className="font-bold">{formatCurrency(totalIfood)}</span>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={disabled || updateManualPayout.isPending}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateManualPayout.isPending ? "Salvando..." : "Salvar Valores"}
        </Button>
      </CardContent>
    </Card>
  );
};
