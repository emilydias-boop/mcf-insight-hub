import { useState } from "react";
import { Receipt, Upload, Download, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployeeNfse } from "@/hooks/useMyEmployee";
import { NFSE_STATUS_LABELS, NFSE_PAGAMENTO_LABELS } from "@/types/hr";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Employee, RhNfse } from "@/types/hr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EnviarNfseModal } from "./EnviarNfseModal";

interface MeuRHNfseSectionProps {
  employee: Employee;
}

export function MeuRHNfseSection({ employee }: MeuRHNfseSectionProps) {
  const { data: nfseList, isLoading, refetch } = useMyEmployeeNfse(employee.id);
  const [modalOpen, setModalOpen] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  // Find NFSe for current month
  const currentNfse = nfseList?.find(n => n.mes === currentMonth && n.ano === currentYear);
  // Get last 5 NFSes excluding current
  const historico = nfseList?.filter(n => !(n.mes === currentMonth && n.ano === currentYear)).slice(0, 5) || [];

  const handleDownload = async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('user-files')
        .createSignedUrl(storagePath, 60);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const formatMonth = (mes: number, ano: number) => {
    const date = new Date(ano, mes - 1, 1);
    return format(date, 'MMM/yyyy', { locale: ptBR });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getStatusBadge = (nfse: RhNfse) => {
    // Determine overall status
    if (nfse.status_pagamento === 'pago') {
      return <Badge className="bg-green-500 text-white text-[10px]">Paga</Badge>;
    }
    if (nfse.status_nfse === 'nota_enviada') {
      return <Badge className="bg-blue-500 text-white text-[10px]">Enviada</Badge>;
    }
    return <Badge className="bg-yellow-500 text-white text-[10px]">Pendente</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Card NFSe do mês atual */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              NFSe do mês atual
            </CardTitle>
            {(!currentNfse || currentNfse.status_nfse === 'pendente_envio') && (
              <Button size="sm" className="h-7 text-xs" onClick={() => setModalOpen(true)}>
                <Upload className="h-3 w-3 mr-1" />
                Enviar NFSe
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : currentNfse ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">
                    {format(new Date(currentYear, currentMonth - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  {getStatusBadge(currentNfse)}
                </div>
                {currentNfse.storage_path && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => handleDownload(currentNfse.storage_path!)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Valor</span>
                  <p className="font-medium">{formatCurrency(currentNfse.valor_nfse)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Nº Nota</span>
                  <p className="font-medium">{currentNfse.numero_nfse || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data prevista</span>
                  <p className="font-medium">
                    {currentNfse.data_pagamento 
                      ? format(new Date(currentNfse.data_pagamento), 'dd/MM/yyyy')
                      : `05/${String(currentMonth + 1 > 12 ? 1 : currentMonth + 1).padStart(2, '0')}/${currentMonth + 1 > 12 ? currentYear + 1 : currentYear}`}
                  </p>
                </div>
              </div>
              {currentNfse.data_envio_nfse && (
                <p className="text-[10px] text-muted-foreground">
                  Enviada em {format(new Date(currentNfse.data_envio_nfse), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma NFSe enviada para este mês</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Envie até o dia 5 para garantir pagamento no prazo
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de NFs */}
      {historico.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Histórico de NFs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {historico.map((nfse) => (
                <div
                  key={nfse.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium w-16">{formatMonth(nfse.mes, nfse.ano)}</span>
                    <span className="text-xs">{formatCurrency(nfse.valor_nfse)}</span>
                    {getStatusBadge(nfse)}
                  </div>
                  <div className="flex items-center gap-2">
                    {nfse.data_pagamento && (
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(nfse.data_pagamento), 'dd/MM/yy')}
                      </span>
                    )}
                    {nfse.storage_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleDownload(nfse.storage_path!)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de envio */}
      <EnviarNfseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        employeeId={employee.id}
        onSuccess={() => {
          refetch();
          setModalOpen(false);
        }}
      />
    </div>
  );
}
