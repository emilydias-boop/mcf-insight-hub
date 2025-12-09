import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMarkAsRead, useConfirmReading } from "@/hooks/usePlaybookReads";
import { useNotionPlaybookContent, NotionPlaybookDoc } from "@/hooks/useNotionPlaybook";
import { Loader2, ExternalLink, FileText } from "lucide-react";

interface PlaybookViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: NotionPlaybookDoc | null;
  currentStatus?: string;
}

export function PlaybookViewer({ open, onOpenChange, doc, currentStatus }: PlaybookViewerProps) {
  const [agreed, setAgreed] = useState(false);
  
  const markAsRead = useMarkAsRead();
  const confirmReading = useConfirmReading();

  // Buscar conteúdo do Notion se for tipo texto
  const { data: notionContent, isLoading: loadingContent } = useNotionPlaybookContent(
    open && doc?.tipo_conteudo === 'texto' ? doc.notion_page_id : null
  );

  // Marcar como lido ao abrir
  useEffect(() => {
    if (open && doc && currentStatus === 'nao_lido') {
      // Usar notion_page_id como identificador
      markAsRead.mutate(doc.notion_page_id);
    }
  }, [open, doc, currentStatus]);

  useEffect(() => {
    if (open) {
      setAgreed(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!doc) return;
    await confirmReading.mutateAsync(doc.notion_page_id);
    onOpenChange(false);
  };

  const handleOpenLink = () => {
    if (doc?.link_url) {
      window.open(doc.link_url, '_blank');
      if (currentStatus === 'nao_lido') {
        markAsRead.mutate(doc.notion_page_id);
      }
    }
  };

  const handleOpenNotion = () => {
    if (doc?.notion_url) {
      window.open(doc.notion_url, '_blank');
    }
  };

  if (!doc) return null;

  const isConfirmed = currentStatus === 'confirmado';
  const showConfirmButton = doc.obrigatorio && !isConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{doc.titulo}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Versão {doc.versao}</span>
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
            <ScrollArea className="h-[500px] border rounded-lg p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {notionContent || (
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum conteúdo encontrado.</p>
                    <Button variant="outline" onClick={handleOpenNotion} className="mt-4">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Editar no Notion
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
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
            <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/50">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground">
                Os arquivos estão anexados na página do Notion.
              </p>
              <Button onClick={handleOpenNotion}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir no Notion
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Conteúdo não disponível.
            </div>
          )}
        </div>

        {showConfirmButton && (
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

        {isConfirmed && (
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
