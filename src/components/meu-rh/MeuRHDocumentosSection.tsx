import { FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployeeDocuments } from "@/hooks/useMyEmployee";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";

interface MeuRHDocumentosSectionProps {
  employee: Employee;
}

export function MeuRHDocumentosSection({ employee }: MeuRHDocumentosSectionProps) {
  const { data: documents, isLoading } = useMyEmployeeDocuments(employee.id);

  // Filter only visible documents
  const visibleDocs = documents?.filter(d => d.visivel_colaborador) || [];

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

  const getFileExtension = (path: string | null) => {
    if (!path) return 'DOC';
    const ext = path.split('.').pop()?.toUpperCase() || 'DOC';
    return ext.length > 4 ? 'DOC' : ext;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : visibleDocs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nenhum documento disponível
          </p>
        ) : (
          <div className="space-y-2">
            {visibleDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-md bg-muted/30"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                    {getFileExtension(doc.storage_path)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.titulo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.tipo_documento} • {format(new Date(doc.created_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                {doc.storage_path && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleDownload(doc.storage_path!)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
