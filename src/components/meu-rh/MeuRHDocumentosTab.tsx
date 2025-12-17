import { useState } from "react";
import { FileText, Upload, Download, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployeeDocuments } from "@/hooks/useMyEmployee";
import { DOCUMENT_STATUS_LABELS } from "@/types/hr";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";
import { EnviarDocumentoModal } from "./EnviarDocumentoModal";

interface MeuRHDocumentosTabProps {
  employee: Employee;
}

export function MeuRHDocumentosTab({ employee }: MeuRHDocumentosTabProps) {
  const { data: documents, isLoading, refetch } = useMyEmployeeDocuments(employee.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string>('');

  const handleDownload = async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('user-files')
        .createSignedUrl(storagePath, 60);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast.error('Erro ao baixar documento');
    }
  };

  const handleOpenUpload = (docId: string, titulo: string) => {
    setSelectedDocId(docId);
    setSelectedDocTitle(titulo);
    setModalOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aprovado': return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case 'rejeitado': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'pendente': return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  const canUpload = (status: string) => ['pendente', 'rejeitado'].includes(status);

  return (
    <div className="space-y-4">
      {/* Lista de documentos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Meus Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !documents || documents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Nenhum documento disponível
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border/50 bg-muted/20"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(doc.status)}
                      <p className="text-xs font-medium">{doc.titulo}</p>
                      <Badge className={`${DOCUMENT_STATUS_LABELS[doc.status].color} text-white text-[10px]`}>
                        {DOCUMENT_STATUS_LABELS[doc.status].label}
                      </Badge>
                      {doc.obrigatorio && (
                        <Badge variant="outline" className="text-[10px]">Obrigatório</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>{doc.tipo_documento}</span>
                      {doc.created_at && (
                        <span>Enviado em {format(new Date(doc.created_at), 'dd/MM/yyyy')}</span>
                      )}
                      {doc.data_validade && (
                        <span>Validade: {format(new Date(doc.data_validade), 'dd/MM/yyyy')}</span>
                      )}
                    </div>
                    {doc.observacao_status && (
                      <p className="text-[10px] text-muted-foreground italic mt-1">
                        Obs: {doc.observacao_status}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {doc.storage_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleDownload(doc.storage_path!)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canUpload(doc.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => handleOpenUpload(doc.id, doc.titulo)}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Enviar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de envio */}
      <EnviarDocumentoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        documentId={selectedDocId}
        documentTitle={selectedDocTitle}
        employeeId={employee.id}
        onSuccess={() => {
          refetch();
          setModalOpen(false);
        }}
      />
    </div>
  );
}
