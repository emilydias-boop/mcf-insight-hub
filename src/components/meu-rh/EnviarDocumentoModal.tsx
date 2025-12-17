import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

interface EnviarDocumentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentTitle: string;
  employeeId: string;
  onSuccess: () => void;
}

export function EnviarDocumentoModal({ 
  open, 
  onOpenChange, 
  documentId,
  documentTitle,
  employeeId, 
  onSuccess 
}: EnviarDocumentoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [observacao, setObservacao] = useState('');

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecione um arquivo');
      return;
    }

    if (!documentId) {
      toast.error('Documento não identificado');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}/doc-${documentId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Atualizar registro do documento
      const { error: updateError } = await supabase
        .from('employee_documents')
        .update({
          storage_path: fileName,
          status: 'pendente',
          observacao_status: observacao || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      toast.success('Documento enviado com sucesso!');
      
      // Reset form
      setFile(null);
      setObservacao('');
      
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao enviar documento:', error);
      toast.error(error.message || 'Erro ao enviar documento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Enviar Documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-muted-foreground">Documento:</p>
            <p className="text-sm font-medium">{documentTitle}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Arquivo</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="h-9 text-xs"
            />
            {file && (
              <p className="text-[10px] text-muted-foreground">{file.name}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Formatos aceitos: PDF, JPG, PNG, DOC, DOCX
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Alguma observação sobre este documento..."
              className="min-h-[60px] text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !file}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
