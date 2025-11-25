import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImportStats {
  success: boolean;
  message: string;
  processed?: number;
  errors?: Array<{ row: number; error: string }>;
}

interface ImportMetricsDialogProps {
  onImportSuccess?: () => void;
}

export function ImportMetricsDialog({ onImportSuccess }: ImportMetricsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx')) {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo .xlsx",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setStats(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione uma planilha para importar",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setStats(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.functions.invoke('import-spreadsheet-data', {
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setStats({
        success: true,
        message: data.message || 'Importação concluída com sucesso',
        processed: data.processed || 0,
      });

      toast({
        title: "Importação concluída",
        description: `${data.processed || 0} registros processados com sucesso`,
      });

      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setStats({
        success: false,
        message: error.message || 'Erro ao importar planilha',
      });
      toast({
        title: "Erro na importação",
        description: error.message || 'Ocorreu um erro ao processar a planilha',
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedFile(null);
    setStats(null);
    setProgress(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Métricas Semanais</DialogTitle>
          <DialogDescription>
            Importe sua planilha Excel (.xlsx) com a aba "Resultados Semanais"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-2">
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              disabled={isImporting}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              {selectedFile ? (
                <div className="text-sm">
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Clique para selecionar</p>
                  <p>ou arraste seu arquivo aqui</p>
                  <p className="text-xs mt-1">Apenas arquivos .xlsx</p>
                </div>
              )}
            </label>
          </div>

          {/* Progress */}
          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Importando dados... {progress}%
              </p>
            </div>
          )}

          {/* Results */}
          {stats && (
            <div
              className={`rounded-lg p-4 flex items-start gap-3 ${
                stats.success
                  ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
              }`}
            >
              {stats.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{stats.message}</p>
                {stats.processed !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {stats.processed} registros processados
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {stats ? 'Fechar' : 'Cancelar'}
            </Button>
            {!stats && (
              <Button onClick={handleImport} disabled={!selectedFile || isImporting}>
                {isImporting ? 'Importando...' : 'Importar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
