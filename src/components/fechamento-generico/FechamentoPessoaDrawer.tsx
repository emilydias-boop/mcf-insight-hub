import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Check, Calculator, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FechamentoStatusBadge } from "./FechamentoStatusBadge";
import { FechamentoPessoa } from "@/types/fechamento-generico";

interface FechamentoPessoaDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoa: (FechamentoPessoa & { 
    employee: { id: string; nome_completo: string; cargo: string } | null; 
    cargo: { id: string; nome_exibicao: string } | null;
  }) | null;
  onApprove?: (pessoaId: string) => void;
  onUpdate?: (pessoaId: string, updates: Partial<FechamentoPessoa>) => void;
}

export function FechamentoPessoaDrawer({
  open,
  onOpenChange,
  pessoa,
  onApprove,
  onUpdate,
}: FechamentoPessoaDrawerProps) {
  const [ajuste, setAjuste] = useState<number>(0);
  const [motivoAjuste, setMotivoAjuste] = useState("");

  if (!pessoa) return null;

  const handleApprove = () => {
    if (onApprove) {
      onApprove(pessoa.id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const pctAtingido = pessoa.variavel_bruto > 0 
    ? ((pessoa.variavel_final / pessoa.variavel_bruto) * 100) 
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {pessoa.employee?.nome_completo || "Colaborador"}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {pessoa.cargo?.nome_exibicao || pessoa.employee?.cargo || "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status e Info */}
          <div className="flex items-center justify-between">
            <FechamentoStatusBadge status={pessoa.status} type="pessoa" />
            {pessoa.aprovado_em && (
              <span className="text-xs text-muted-foreground">
                Aprovado em {format(new Date(pessoa.aprovado_em), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
          </div>

          <Separator />

          {/* Resumo Financeiro */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fixo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{formatCurrency(pessoa.fixo_valor)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Variável Bruto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{formatCurrency(pessoa.variavel_bruto)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Multiplicador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{pessoa.multiplicador_final.toFixed(2)}x</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Variável Final
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(pessoa.variavel_final)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Total a Pagar */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(pessoa.total_a_pagar)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {pctAtingido.toFixed(0)}% da meta de variável
              </p>
            </CardContent>
          </Card>

          <Separator />

          {/* Ajuste Manual */}
          {pessoa.status !== "aprovado" && pessoa.status !== "pago" && (
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Ajuste Manual
              </h3>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="ajuste">Valor do Ajuste (+ ou -)</Label>
                  <Input
                    id="ajuste"
                    type="number"
                    step="0.01"
                    value={ajuste}
                    onChange={(e) => setAjuste(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="motivo">Motivo do Ajuste</Label>
                  <Textarea
                    id="motivo"
                    value={motivoAjuste}
                    onChange={(e) => setMotivoAjuste(e.target.value)}
                    placeholder="Descreva o motivo do ajuste..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Fechar
            </Button>
            {pessoa.status === "calculado" && (
              <Button className="flex-1" onClick={handleApprove}>
                <Check className="h-4 w-4 mr-2" />
                Aprovar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
