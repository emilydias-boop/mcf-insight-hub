import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { useUploadBoleto } from '@/hooks/useConsorcioBoletos';

interface UploadResult {
  fileName: string;
  status: 'uploading' | 'success' | 'error';
  matchConfidence?: string;
  error?: string;
  boletoName?: string;
}

export function BoletoUploadDialog() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const uploadBoleto = useUploadBoleto();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    setIsProcessing(true);
    const newResults: UploadResult[] = pdfFiles.map(f => ({
      fileName: f.name,
      status: 'uploading' as const,
    }));
    setResults(newResults);

    for (let i = 0; i < pdfFiles.length; i++) {
      try {
        const data = await uploadBoleto.mutateAsync(pdfFiles[i]);
        setResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            status: 'success' as const,
            matchConfidence: data.matchConfidence,
            boletoName: data.boleto?.nome_extraido,
          } : r
        ));
      } catch (err: any) {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error' as const, error: err.message } : r
        ));
      }
    }
    setIsProcessing(false);
  }, [uploadBoleto]);

  const completedCount = results.filter(r => r.status !== 'uploading').length;
  const progress = results.length > 0 ? (completedCount / results.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1" />
          Subir Boletos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>📎 Upload de Boletos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dropzone */}
          <label
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
          >
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Arraste PDFs aqui ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">Apenas arquivos PDF</p>
            <input
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>

          {/* Progress */}
          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{completedCount} de {results.length} processados</span>
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <Progress value={progress} />

              {/* Results list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm">
                    {r.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                    {r.status === 'success' && r.matchConfidence === 'exact' && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                    {r.status === 'success' && r.matchConfidence === 'partial' && <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />}
                    {r.status === 'success' && r.matchConfidence === 'pending_review' && <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />}
                    {r.status === 'error' && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{r.fileName}</p>
                      {r.boletoName && <p className="text-xs text-muted-foreground truncate">{r.boletoName}</p>}
                      {r.error && <p className="text-xs text-red-600 truncate">{r.error}</p>}
                    </div>

                    {r.status === 'success' && (
                      <Badge variant="outline" className={
                        r.matchConfidence === 'exact' ? 'bg-green-100 text-green-800' :
                        r.matchConfidence === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-orange-100 text-orange-800'
                      }>
                        {r.matchConfidence === 'exact' ? 'Vinculado' :
                         r.matchConfidence === 'partial' ? 'Parcial' : 'Revisar'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
