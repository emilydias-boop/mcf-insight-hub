import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useMarkAsRead, useConfirmReading } from "@/hooks/usePlaybookReads";
import { useNotionPlaybookContent, useUpdateNotionPlaybookContent, NotionPlaybookDoc } from "@/hooks/useNotionPlaybook";
import { useAuth } from "@/contexts/AuthContext";
import { PlaybookDocWithRead } from "@/types/playbook";
import { Loader2, ExternalLink, FileText, Download, File, Pencil, X, Save } from "lucide-react";

interface FileInfo {
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'other';
}

// Aceitar tanto PlaybookDocWithRead (MeuPlaybook) quanto NotionPlaybookDoc (gestão)
type ViewerDoc = PlaybookDocWithRead | NotionPlaybookDoc;

interface PlaybookViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: ViewerDoc | null;
  currentStatus?: string;
}

export function PlaybookViewer({ open, onOpenChange, doc, currentStatus }: PlaybookViewerProps) {
  const [agreed, setAgreed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  
  const { role } = useAuth();
  const markAsRead = useMarkAsRead();
  const confirmReading = useConfirmReading();
  const updateContent = useUpdateNotionPlaybookContent();

  // Roles que podem editar
  const canEdit = ['admin', 'manager', 'coordenador', 'master', 'gestor_sdr', 'gestor_closer'].includes(role || '');

  // Buscar conteúdo do Notion para texto OU arquivo
  const shouldFetchContent = open && doc?.notion_page_id && (doc?.tipo_conteudo === 'texto' || doc?.tipo_conteudo === 'arquivo');
  const { data: notionData, isLoading: loadingContent } = useNotionPlaybookContent(
    shouldFetchContent ? doc.notion_page_id : null
  );

  // Helper para obter ID do documento (PlaybookDocWithRead tem 'id', NotionPlaybookDoc usa 'notion_page_id')
  const getDocId = () => {
    if (!doc) return null;
    return 'id' in doc ? doc.id : doc.notion_page_id;
  };

  // Marcar como lido ao abrir (apenas para PlaybookDocWithRead)
  useEffect(() => {
    if (open && doc && currentStatus === 'nao_lido' && 'id' in doc) {
      markAsRead.mutate(doc.id);
    }
  }, [open, doc, currentStatus]);

  useEffect(() => {
    if (open) {
      setAgreed(false);
      setIsEditing(false);
    }
  }, [open]);

  // Sincronizar conteúdo quando carregado
  useEffect(() => {
    if (notionData?.content) {
      setEditContent(notionData.content);
    }
  }, [notionData?.content]);

  const handleConfirm = async () => {
    if (!doc || !('id' in doc)) return;
    await confirmReading.mutateAsync(doc.id);
    onOpenChange(false);
  };

  const handleOpenLink = () => {
    if (doc?.link_url) {
      window.open(doc.link_url, '_blank');
      if (currentStatus === 'nao_lido' && 'id' in doc) {
        markAsRead.mutate(doc.id);
      }
    }
  };

  const handleOpenNotion = () => {
    if (doc?.notion_url) {
      window.open(doc.notion_url, '_blank');
    }
  };

  const handleDownloadFile = async (file: FileInfo) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      window.open(file.url, '_blank');
    }
  };

  const handleStartEdit = () => {
    setEditContent(notionData?.content || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(notionData?.content || '');
    setIsEditing(false);
  };

  const handleSaveContent = async () => {
    if (!doc?.notion_page_id) return;
    
    await updateContent.mutateAsync({
      pageId: doc.notion_page_id,
      content: editContent
    });
    
    setIsEditing(false);
  };

  if (!doc) return null;

  const isConfirmed = currentStatus === 'confirmado';
  const showConfirmButton = doc.obrigatorio && !isConfirmed;
  
  const notionContent = notionData?.content || '';
  const notionFiles: FileInfo[] = (notionData?.files as FileInfo[]) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{doc.titulo}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Versão {doc.versao}</span>
            {doc.tipo_conteudo === 'texto' && canEdit && !isEditing && (
              <Button variant="ghost" size="sm" onClick={handleStartEdit} className="h-6 px-2">
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
            {doc.notion_url && (
              <Button variant="ghost" size="sm" onClick={handleOpenNotion} className="h-6 px-2">
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir no Notion
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-[400px]">
          {loadingContent ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : doc.tipo_conteudo === 'texto' ? (
            isEditing ? (
              <div className="flex flex-col h-[500px] gap-3">
                <div className="text-xs text-muted-foreground">
                  Suporte: # Título, ## Subtítulo, ### Seção, - lista, 1. numerada
                </div>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 font-mono text-sm resize-none"
                  placeholder="Digite o conteúdo aqui..."
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={updateContent.isPending}>
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveContent} disabled={updateContent.isPending}>
                    {updateContent.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[500px] border rounded-lg p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {notionContent || (
                    <div className="text-center text-muted-foreground py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum conteúdo encontrado.</p>
                      {canEdit && (
                        <Button variant="outline" onClick={handleStartEdit} className="mt-4">
                          <Pencil className="mr-2 h-4 w-4" />
                          Adicionar conteúdo
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )
          ) : doc.tipo_conteudo === 'link' ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/50">
              <ExternalLink className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground">
                Este documento é um link externo.
              </p>
              <Button onClick={handleOpenLink}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir link
              </Button>
            </div>
          ) : doc.tipo_conteudo === 'arquivo' ? (
            <ScrollArea className="h-[500px]">
              {notionFiles.length > 0 ? (
                <div className="space-y-4 p-4">
                  {notionFiles.map((file, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      {file.type === 'pdf' ? (
                        <div className="flex flex-col">
                          <iframe
                            src={file.url}
                            className="w-full h-[400px] border-0"
                            title={file.name}
                          />
                          <div className="flex items-center justify-between p-3 bg-muted/50 border-t">
                            <span className="text-sm font-medium truncate">{file.name}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadFile(file)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Baixar
                            </Button>
                          </div>
                        </div>
                      ) : file.type === 'image' ? (
                        <div className="flex flex-col">
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full max-h-[400px] object-contain bg-background"
                          />
                          <div className="flex items-center justify-between p-3 bg-muted/50 border-t">
                            <span className="text-sm font-medium truncate">{file.name}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadFile(file)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Baixar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 bg-muted/50">
                          <div className="flex items-center gap-3">
                            <File className="h-8 w-8 text-muted-foreground" />
                            <span className="font-medium">{file.name}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFile(file)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/50">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    Nenhum arquivo encontrado nesta página.
                    <br />
                    <span className="text-sm">Anexe arquivos diretamente no Notion.</span>
                  </p>
                  <Button onClick={handleOpenNotion}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir no Notion para anexar
                  </Button>
                </div>
              )}
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Conteúdo não disponível.
            </div>
          )}
        </div>

        {showConfirmButton && !isEditing && (
          <DialogFooter className="flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <Label htmlFor="agree" className="text-sm">
                Li e concordo com este conteúdo
              </Label>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={!agreed || confirmReading.isPending}
            >
              {confirmReading.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar leitura
            </Button>
          </DialogFooter>
        )}

        {isConfirmed && !isEditing && (
          <DialogFooter>
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ Leitura confirmada
            </p>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
