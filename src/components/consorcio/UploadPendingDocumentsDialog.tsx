import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import { TIPO_DOCUMENTO_OPTIONS, TipoDocumento } from '@/types/consorcio';
import { useConsorcioDocuments, useBatchUploadDocuments, useDeleteConsorcioDocument } from '@/hooks/useConsorcioDocuments';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  contactName?: string;
}

export function UploadPendingDocumentsDialog({ open, onOpenChange, cardId, contactName }: Props) {
  const { data: existing = [] } = useConsorcioDocuments(open ? cardId : null);
  const upload = useBatchUploadDocuments();
  const remove = useDeleteConsorcioDocument();
  const [pending, setPending] = useState<Array<{ file: File; tipo: TipoDocumento }>>([]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newOnes = Array.from(files).map(f => ({ file: f, tipo: 'outro' as TipoDocumento }));
    setPending(prev => [...prev, ...newOnes]);
  };

  const handleUpload = async () => {
    if (pending.length === 0) {
      toast.error('Selecione ao menos um arquivo');
      return;
    }
    await upload.mutateAsync({ cardId, documents: pending });
    toast.success('Documentos enviados com sucesso');
    setPending([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anexar Documentos {contactName ? `— ${contactName}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {existing.length > 0 && (
            <div>
              <Label className="text-sm">Documentos já anexados</Label>
              <div className="mt-2 space-y-2">
                {existing.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{doc.nome_arquivo}</span>
                      <span className="text-xs text-muted-foreground capitalize">{doc.tipo.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.storage_url && (
                        <a href={doc.storage_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                          Abrir
                        </a>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => remove.mutate({ documentId: doc.id, storagePath: doc.storage_path, cardId })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm">Adicionar novos documentos</Label>
            <Input type="file" multiple onChange={e => addFiles(e.target.files)} className="mt-2" />
          </div>

          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded border p-2">
                  <span className="flex-1 truncate text-sm">{item.file.name}</span>
                  <Select
                    value={item.tipo}
                    onValueChange={(v) => setPending(prev => prev.map((p, i) => i === idx ? { ...p, tipo: v as TipoDocumento } : p))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_DOCUMENTO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setPending(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={upload.isPending || pending.length === 0}>
            {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Enviar {pending.length > 0 ? `(${pending.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
