import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Edit, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePendingMetrics, PendingMetric } from "@/hooks/usePendingMetrics";
import { formatCurrency, formatPercent } from "@/lib/formatters";

interface MetricsApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetricsApprovalDialog({ open, onOpenChange }: MetricsApprovalDialogProps) {
  const { 
    pendingMetrics, 
    approveMetrics, 
    rejectMetrics, 
    editAndApproveMetrics,
    isApproving,
    isRejecting,
    isEditing,
  } = usePendingMetrics();

  const [selectedMetric, setSelectedMetric] = useState<PendingMetric | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [corrections, setCorrections] = useState<Partial<PendingMetric>>({});

  // Set first pending metric as selected when dialog opens
  useEffect(() => {
    if (open && pendingMetrics.length > 0 && !selectedMetric) {
      setSelectedMetric(pendingMetrics[0]);
    }
  }, [open, pendingMetrics, selectedMetric]);

  const formatWeekLabel = (metric: PendingMetric) => {
    if (metric.week_label) return metric.week_label;
    const start = parseISO(metric.start_date);
    const end = parseISO(metric.end_date);
    return `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  const handleApprove = () => {
    if (!selectedMetric) return;
    approveMetrics({ metricId: selectedMetric.id, notes });
    setSelectedMetric(null);
    setNotes("");
    if (pendingMetrics.length <= 1) {
      onOpenChange(false);
    }
  };

  const handleReject = () => {
    if (!selectedMetric || !rejectReason.trim()) return;
    rejectMetrics({ metricId: selectedMetric.id, reason: rejectReason });
    setSelectedMetric(null);
    setRejectReason("");
    if (pendingMetrics.length <= 1) {
      onOpenChange(false);
    }
  };

  const handleEditAndApprove = () => {
    if (!selectedMetric) return;
    editAndApproveMetrics({ 
      metricId: selectedMetric.id, 
      corrections,
      notes: notes || 'Valores corrigidos manualmente'
    });
    setSelectedMetric(null);
    setCorrections({});
    setNotes("");
    setIsEditMode(false);
    if (pendingMetrics.length <= 1) {
      onOpenChange(false);
    }
  };

  const updateCorrection = (field: keyof PendingMetric, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCorrections(prev => ({ ...prev, [field]: numValue }));
  };

  const getValue = (field: keyof PendingMetric) => {
    if (corrections[field] !== undefined) {
      return corrections[field];
    }
    return selectedMetric?.[field] ?? 0;
  };

  const metricFields = [
    { key: 'faturamento_total', label: 'Faturamento Total', format: formatCurrency },
    { key: 'ads_cost', label: 'Gastos Ads', format: formatCurrency },
    { key: 'total_cost', label: 'Custo Total', format: formatCurrency },
    { key: 'operating_profit', label: 'Lucro', format: formatCurrency },
    { key: 'roi', label: 'ROI', format: (v: number) => formatPercent(v / 100) },
    { key: 'roas', label: 'ROAS', format: (v: number) => v?.toFixed(2) || '0' },
    { key: 'cpl', label: 'CPL', format: formatCurrency },
    { key: 'a010_sales', label: 'Vendas A010', format: (v: number) => v?.toString() || '0' },
    { key: 'faturamento_clint', label: 'Faturamento Clint', format: formatCurrency },
    { key: 'incorporador_50k', label: 'Incorporador 50k', format: formatCurrency },
    { key: 'ultrameta_clint', label: 'Ultrameta Clint', format: formatCurrency },
    { key: 'ultrameta_liquido', label: 'Ultrameta Líquido', format: formatCurrency },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprovação de Métricas Semanais</DialogTitle>
          <DialogDescription>
            Revise as métricas calculadas automaticamente antes de aprová-las.
          </DialogDescription>
        </DialogHeader>

        {pendingMetrics.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Não há métricas pendentes de aprovação.
          </div>
        ) : (
          <Tabs defaultValue={pendingMetrics[0]?.id} onValueChange={(id) => {
            const metric = pendingMetrics.find(m => m.id === id);
            setSelectedMetric(metric || null);
            setCorrections({});
            setIsEditMode(false);
          }}>
            <TabsList className="mb-4">
              {pendingMetrics.map((metric) => (
                <TabsTrigger key={metric.id} value={metric.id}>
                  {formatWeekLabel(metric)}
                </TabsTrigger>
              ))}
            </TabsList>

            {pendingMetrics.map((metric) => (
              <TabsContent key={metric.id} value={metric.id} className="space-y-4">
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {metricFields.map(({ key, label, format }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      {isEditMode ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={getValue(key as keyof PendingMetric) as number}
                          onChange={(e) => updateCorrection(key as keyof PendingMetric, e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        <div className="font-medium">
                          {format(metric[key as keyof PendingMetric] as number)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    placeholder="Adicione notas sobre esta aprovação..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {!isEditMode && (
                  <div className="space-y-2">
                    <Label>Motivo da Rejeição (obrigatório se rejeitar)</Label>
                    <Textarea
                      placeholder="Explique o motivo da rejeição..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-4 border-t">
                  {isEditMode ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditMode(false);
                          setCorrections({});
                        }}
                      >
                        Cancelar Edição
                      </Button>
                      <Button
                        onClick={handleEditAndApprove}
                        disabled={isEditing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isEditing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Salvar e Aprovar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditMode(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar Valores
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={isRejecting || !rejectReason.trim()}
                      >
                        {isRejecting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Rejeitar
                      </Button>
                      <Button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApproving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Aprovar
                      </Button>
                    </>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
