import { useState } from "react";
import { Receipt, Upload, Download, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployeeNfse } from "@/hooks/useMyEmployee";
import { NFSE_STATUS_LABELS, NFSE_PAGAMENTO_LABELS } from "@/types/hr";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EnviarNfseModal } from "./EnviarNfseModal";

interface MeuRHNfseTabProps {
  employee: Employee;
}

export function MeuRHNfseTab({ employee }: MeuRHNfseTabProps) {
  const { data: nfseList, isLoading, refetch } = useMyEmployeeNfse(employee.id);
  const [modalOpen, setModalOpen] = useState(false);

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
    return format(date, 'MMMM yyyy', { locale: ptBR });
  };

  return (
    <div className="space-y-4">
      {/* Texto explicativo */}
      <Card className="bg-muted/30 border-muted">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Aqui você acompanha o envio de NFSes e o status de conferência pelo financeiro.
              Envie sua nota fiscal até o dia 5 de cada mês para garantir o pagamento no prazo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botão Enviar NFSe */}
      <div className="flex justify-end">
        <Button size="sm" className="h-8 text-xs" onClick={() => setModalOpen(true)}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          Enviar NFSe deste mês
        </Button>
      </div>

      {/* Lista de NFSe */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Minhas NFSes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !nfseList || nfseList.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Nenhuma NFSe enviada ainda
            </p>
          ) : (
            <div className="space-y-2">
              {nfseList.map((nfse) => (
                <div
                  key={nfse.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border/50 bg-muted/20"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium capitalize">
                        {formatMonth(nfse.mes, nfse.ano)}
                      </p>
                      <Badge className={`${NFSE_STATUS_LABELS[nfse.status_nfse].color} text-white text-[10px]`}>
                        {NFSE_STATUS_LABELS[nfse.status_nfse].label}
                      </Badge>
                      <Badge className={`${NFSE_PAGAMENTO_LABELS[nfse.status_pagamento].color} text-white text-[10px]`}>
                        {NFSE_PAGAMENTO_LABELS[nfse.status_pagamento].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      {nfse.numero_nfse && <span>Nota #{nfse.numero_nfse}</span>}
                      <span>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nfse.valor_nfse)}
                      </span>
                      {nfse.data_envio_nfse && (
                        <span>Enviada em {format(new Date(nfse.data_envio_nfse), 'dd/MM/yyyy')}</span>
                      )}
                    </div>
                  </div>
                  {nfse.storage_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleDownload(nfse.storage_path!)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
