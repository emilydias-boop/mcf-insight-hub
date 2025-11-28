import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FileType = "sales" | "refunds";

interface ImportResult {
  success: boolean;
  message: string;
  processedCount?: number;
  skippedCount?: number;
  errorCount?: number;
}

export default function ImportarHubla() {
  const [fileType, setFileType] = useState<FileType>("sales");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
      setResult(null);
    } else {
      toast.error("Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  }, []);

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo para importar");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fileType', fileType);

      // Simular progresso enquanto faz upload
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke('import-hubla-history', {
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setResult({
        success: true,
        message: data.message || "Importação concluída com sucesso",
        processedCount: data.processedCount,
        skippedCount: data.skippedCount,
        errorCount: data.errorCount,
      });

      toast.success("Importação concluída!");
      
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      setResult({
        success: false,
        message: error.message || "Erro ao importar arquivo",
      });
      toast.error("Erro ao importar arquivo");
    } finally {
      setIsUploading(false);
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setProgress(0);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Histórico Hubla</h1>
        <p className="text-muted-foreground mt-2">
          Faça upload dos arquivos históricos de faturamento e reembolso da Hubla
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de Arquivo</CardTitle>
          <CardDescription>
            Selecione o tipo de transação e faça upload do arquivo Excel ou CSV
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tipo de Arquivo */}
          <div className="space-y-3">
            <Label>Tipo de Transação</Label>
            <RadioGroup
              value={fileType}
              onValueChange={(value) => setFileType(value as FileType)}
              disabled={isUploading}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sales" id="sales" />
                <Label htmlFor="sales" className="font-normal cursor-pointer">
                  Faturamento (Vendas Pagas)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="refunds" id="refunds" />
                <Label htmlFor="refunds" className="font-normal cursor-pointer">
                  Reembolso (Vendas Reembolsadas)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
              ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
            `}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-10 h-10 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetImport}
                  >
                    Remover
                  </Button>
                )}
              </div>
            ) : (
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground mb-2">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
                <p className="text-sm text-muted-foreground">
                  Arquivos Excel (.xlsx, .xls) ou CSV aceitos
                </p>
              </label>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processando arquivo...</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Result */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <AlertDescription className="font-medium">
                    {result.message}
                  </AlertDescription>
                  {result.success && (
                    <div className="text-sm space-y-1 text-muted-foreground">
                      {result.processedCount !== undefined && (
                        <p>✓ Registros importados: {result.processedCount}</p>
                      )}
                      {result.skippedCount !== undefined && result.skippedCount > 0 && (
                        <p>⊘ Duplicatas ignoradas: {result.skippedCount}</p>
                      )}
                      {result.errorCount !== undefined && result.errorCount > 0 && (
                        <p>✗ Erros: {result.errorCount}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={!selectedFile || isUploading}
              className="flex-1"
            >
              {isUploading ? "Importando..." : "Importar Arquivo"}
            </Button>
            {result && (
              <Button
                variant="outline"
                onClick={resetImport}
              >
                Nova Importação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Instruções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">1. Arquivos de Faturamento:</strong> Devem conter as vendas pagas (completed). 
            O sistema irá mapear automaticamente os produtos para as categorias corretas.
          </p>
          <p>
            <strong className="text-foreground">2. Arquivos de Reembolso:</strong> Devem conter as vendas reembolsadas. 
            Estes valores serão deduzidos da receita bruta para calcular a receita líquida.
          </p>
          <p>
            <strong className="text-foreground">3. Duplicatas:</strong> O sistema verifica automaticamente duplicatas pelo 
            ID da fatura Hubla e ignora registros já importados.
          </p>
          <p>
            <strong className="text-foreground">4. Ordem recomendada:</strong> Importe primeiro os arquivos de faturamento 
            (2024, depois 2025) e em seguida os arquivos de reembolso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
