import { Briefcase, FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployeeDocuments } from "@/hooks/useMyEmployee";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";

interface MeuRHContratoTabProps {
  employee: Employee;
}

export function MeuRHContratoTab({ employee }: MeuRHContratoTabProps) {
  const { data: documents, isLoading } = useMyEmployeeDocuments(employee.id);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  // Filtrar documentos de contrato
  const contractDocuments = documents?.filter(d => 
    d.tipo_documento.toLowerCase().includes('contrato') ||
    d.tipo_documento.toLowerCase().includes('nda') ||
    d.tipo_documento.toLowerCase().includes('termo')
  ) || [];

  const handleDownload = async (storagePath: string, titulo: string) => {
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

  return (
    <div className="space-y-4">
      {/* Dados do Contrato */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Dados do Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FieldDisplay label="Tipo de contrato" value={employee.tipo_contrato} />
            <FieldDisplay label="Carga horária" value={employee.jornada_trabalho} />
            <FieldDisplay label="Data de início" value={formatDate(employee.data_admissao)} />
            <FieldDisplay label="Data de fim" value={formatDate(employee.data_demissao)} />
            <FieldDisplay label="Departamento" value={employee.departamento} />
            <FieldDisplay label="Squad" value={employee.squad} />
            <FieldDisplay label="Cargo" value={employee.cargo} />
          </div>
        </CardContent>
      </Card>

      {/* Documentos do Contrato */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos do Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : contractDocuments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum documento de contrato disponível
            </p>
          ) : (
            <div className="space-y-2">
              {contractDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.titulo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Enviado em {formatDate(doc.created_at)}
                    </p>
                  </div>
                  {doc.storage_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleDownload(doc.storage_path!, doc.titulo)}
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
    </div>
  );
}

function FieldDisplay({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium">{value || '-'}</p>
    </div>
  );
}
