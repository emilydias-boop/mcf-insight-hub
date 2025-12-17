import { useState } from 'react';
import { Employee, EmployeeDocument, DOCUMENT_STATUS_LABELS } from '@/types/hr';
import { useEmployeeDocuments } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Upload, Download, Eye, AlertCircle, Calendar } from 'lucide-react';

interface EmployeeDocumentsTabProps {
  employee: Employee;
}

export default function EmployeeDocumentsTab({ employee }: EmployeeDocumentsTabProps) {
  const { data: documents, isLoading } = useEmployeeDocuments(employee.id);

  const pendingDocs = documents?.filter(d => d.status === 'pendente') || [];
  const approvedDocs = documents?.filter(d => d.status === 'aprovado') || [];
  const otherDocs = documents?.filter(d => !['pendente', 'aprovado'].includes(d.status)) || [];

  const DocumentCard = ({ doc }: { doc: EmployeeDocument }) => (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{doc.titulo}</p>
            <p className="text-xs text-muted-foreground">{doc.tipo_documento}</p>
            {doc.data_validade && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Validade: {format(new Date(doc.data_validade), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={DOCUMENT_STATUS_LABELS[doc.status].color}>
            {DOCUMENT_STATUS_LABELS[doc.status].label}
          </Badge>
          {doc.storage_url && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {doc.descricao && (
        <p className="text-xs text-muted-foreground mt-2 pl-13">{doc.descricao}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Documento
        </Button>
      </div>

      {pendingDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Pendentes ({pendingDocs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </CardContent>
        </Card>
      )}

      {approvedDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aprovados ({approvedDocs.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvedDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </CardContent>
        </Card>
      )}

      {otherDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outros ({otherDocs.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </CardContent>
        </Card>
      )}

      {documents?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum documento cadastrado</p>
            <p className="text-xs mt-1">Faça upload do primeiro documento</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
