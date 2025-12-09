import { useState, useEffect } from "react";
import { PlaybookDoc } from "@/types/playbook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMarkAsRead, useConfirmReading } from "@/hooks/usePlaybookReads";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, Download, FileText } from "lucide-react";

interface PlaybookViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: PlaybookDoc | null;
  currentStatus?: string;
}

export function PlaybookViewer({ open, onOpenChange, doc, currentStatus }: PlaybookViewerProps) {
  const [agreed, setAgreed] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const markAsRead = useMarkAsRead();
  const confirmReading = useConfirmReading();

  // Marcar como lido ao abrir
  useEffect(() => {
    if (open && doc && currentStatus === 'nao_lido') {
      markAsRead.mutate(doc.id);
    }
  }, [open, doc, currentStatus]);

  // Carregar URL do arquivo
  useEffect(() => {
    async function loadFileUrl() {
      if (!doc || doc.tipo_conteudo !== 'arquivo' || !doc.storage_path) {
        setFileUrl(null);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('playbook-files')
          .createSignedUrl(doc.storage_path, 3600); // 1 hora

        if (error) throw error;
        setFileUrl(data.signedUrl);
      } catch (error) {
        console.error('Erro ao carregar arquivo:', error);
      } finally {
        setLoading(false);
      }
    }

    if (open && doc) {
      loadFileUrl();
      setAgreed(false);
    }
  }, [open, doc]);

  const handleConfirm = async () => {
    if (!doc) return;
    await confirmReading.mutateAsync(doc.id);
    onOpenChange(false);
  };

  const handleOpenLink = () => {
    if (doc?.link_url) {
      window.open(doc.link_url, '_blank');
      // Marcar como lido
      if (currentStatus === 'nao_lido') {
        markAsRead.mutate(doc.id);
      }
    }
  };

  const handleDownload = async () => {
    if (!fileUrl) return;
    
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc?.storage_path?.split('/').pop() || 'documento';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
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
          {doc.descricao && (
            <p className="text-sm text-muted-foreground">{doc.descricao}</p>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : doc.tipo_conteudo === 'arquivo' && fileUrl ? (
            <div className="space-y-4">
              {/* Verificar se é PDF para exibir inline */}
              {doc.storage_path?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-[500px] border rounded-lg"
                  title={doc.titulo}
                />
              ) : doc.storage_path?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img
                  src={fileUrl}
                  alt={doc.titulo}
                  className="max-w-full max-h-[500px] mx-auto rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/50">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Visualização não disponível para este tipo de arquivo.
                  </p>
                  <Button onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar arquivo
                  </Button>
                </div>
              )}
              
              {doc.storage_path?.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif|webp)$/i) && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar arquivo
                  </Button>
                </div>
              )}
            </div>
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
          ) : doc.tipo_conteudo === 'texto' ? (
            <ScrollArea className="h-[500px] border rounded-lg p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {doc.conteudo_rico}
              </div>
            </ScrollArea>
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
