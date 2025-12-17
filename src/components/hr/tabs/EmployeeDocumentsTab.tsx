import { useState, useRef } from 'react';
import { Employee, EmployeeDocument, DOCUMENT_STATUS_LABELS } from '@/types/hr';
import { useEmployeeDocuments, useEmployeeMutations } from '@/hooks/useEmployees';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Upload, Download, Eye, AlertCircle, Calendar, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeDocumentsTabProps {
  employee: Employee;
}

const DOCUMENT_TYPES = [
  'RG', 'CPF', 'CNH', 'Comprovante de Residência', 'Certidão de Nascimento',
  'Certidão de Casamento', 'Título de Eleitor', 'Carteira de Trabalho',
  'Certificado', 'Contrato', 'Atestado Médico', 'Outro'
];

export default function EmployeeDocumentsTab({ employee }: EmployeeDocumentsTabProps) {
  const { data: documents, isLoading, refetch } = useEmployeeDocuments(employee.id);
  const { createDocument, updateDocument, deleteDocument } = useEmployeeMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<EmployeeDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState('');
  
  const [formData, setFormData] = useState({
    tipo_documento: '',
    titulo: '',
    descricao: '',
    data_validade: '',
    visivel_colaborador: true,
    status: 'aprovado' as EmployeeDocument['status'],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const pendingDocs = documents?.filter(d => d.status === 'pendente') || [];
  const approvedDocs = documents?.filter(d => d.status === 'aprovado') || [];
  const otherDocs = documents?.filter(d => !['pendente', 'aprovado'].includes(d.status)) || [];

  const resetForm = () => {
    setFormData({
      tipo_documento: '',
      titulo: '',
      descricao: '',
      data_validade: '',
      visivel_colaborador: true,
      status: 'aprovado',
    });
    setSelectedFile(null);
    setSelectedDoc(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (doc: EmployeeDocument) => {
    setSelectedDoc(doc);
    setFormData({
      tipo_documento: doc.tipo_documento,
      titulo: doc.titulo,
      descricao: doc.descricao || '',
      data_validade: doc.data_validade || '',
      visivel_colaborador: doc.visivel_colaborador,
      status: doc.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.tipo_documento || !formData.titulo) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setUploading(true);
    try {
      let storagePath = selectedDoc?.storage_path || null;
      let storageUrl = selectedDoc?.storage_url || null;

      // Upload new file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${employee.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('user-files')
          .getPublicUrl(fileName);

        storagePath = fileName;
        storageUrl = urlData.publicUrl;

        // Delete old file if replacing
        if (selectedDoc?.storage_path && selectedDoc.storage_path !== fileName) {
          await supabase.storage.from('user-files').remove([selectedDoc.storage_path]);
        }
      }

      const docData = {
        ...formData,
        storage_path: storagePath,
        storage_url: storageUrl,
        data_validade: formData.data_validade || null,
      };

      if (selectedDoc) {
        await updateDocument.mutateAsync({ id: selectedDoc.id, data: docData });
      } else {
        await createDocument.mutateAsync({ ...docData, employee_id: employee.id });
      }

      setDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    
    await deleteDocument.mutateAsync({ 
      id: selectedDoc.id, 
      storagePath: selectedDoc.storage_path || undefined 
    });
    setDeleteDialogOpen(false);
    setSelectedDoc(null);
    refetch();
  };

  const handleView = async (doc: EmployeeDocument) => {
    if (!doc.storage_path) return;
    
    const { data } = await supabase.storage
      .from('user-files')
      .createSignedUrl(doc.storage_path, 3600);
    
    if (data?.signedUrl) {
      setViewerUrl(data.signedUrl);
      setViewerOpen(true);
    }
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    if (!doc.storage_path) return;
    
    const { data } = await supabase.storage
      .from('user-files')
      .createSignedUrl(doc.storage_path, 3600);
    
    if (data?.signedUrl) {
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.titulo;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

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
          <div className="flex gap-1">
            {doc.storage_url && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleView(doc)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                  <Download className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(doc)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive" 
              onClick={() => { setSelectedDoc(doc); setDeleteDialogOpen(true); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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
        <Button onClick={openCreateDialog}>
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

      {/* Upload/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDoc ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select value={formData.tipo_documento} onValueChange={(v) => setFormData({ ...formData, tipo_documento: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: RG - Frente e Verso"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Validade</Label>
                <Input
                  type="date"
                  value={formData.data_validade}
                  onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v: EmployeeDocument['status']) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Arquivo {selectedDoc?.storage_url ? '(substituir)' : ''}</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {selectedDoc?.storage_url && !selectedFile && (
                <p className="text-xs text-muted-foreground">Arquivo atual mantido</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.visivel_colaborador}
                onChange={(e) => setFormData({ ...formData, visivel_colaborador: e.target.checked })}
                className="rounded"
              />
              Visível para o colaborador
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedDoc ? 'Salvar' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O documento "{selectedDoc?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualizar Documento</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {viewerUrl.includes('.pdf') ? (
              <iframe src={viewerUrl} className="w-full h-[70vh]" />
            ) : (
              <img src={viewerUrl} alt="Documento" className="max-w-full" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
