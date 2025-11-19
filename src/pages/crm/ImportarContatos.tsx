import { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  errors: number;
  duration: number;
  errorDetails?: Array<{ line: number; name: string; error: string }>;
}

const ImportarContatos = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo: 50 MB');
        return;
      }
      setFile(selectedFile);
      setStats(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    setIsImporting(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgress(30);

      const { data, error } = await supabase.functions.invoke('import-contacts-csv', {
        body: formData,
      });

      if (error) throw error;

      setProgress(100);

      if (data.success) {
        setStats(data.stats);
        toast.success(`Importação concluída! ${data.stats.created} criados, ${data.stats.updated} atualizados`);
      } else {
        throw new Error(data.error || 'Erro na importação');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro ao importar contatos');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorLog = () => {
    if (!stats?.errorDetails || stats.errorDetails.length === 0) return;

    const csvContent = [
      'Linha,Nome,Erro',
      ...stats.errorDetails.map(e => `${e.line},"${e.name}","${e.error}"`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros-importacao.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Importar Contatos</h2>
        <p className="text-muted-foreground mt-1">
          Importe contatos em lote via arquivo CSV
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload do Arquivo CSV</CardTitle>
          <CardDescription>
            O arquivo deve estar no formato CSV com separador ponto-e-vírgula (;)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato esperado:</strong> CSV com separador ";" contendo colunas como: name, email, complete_phone, tags, etc.
              <br />
              O sistema irá criar novos contatos ou atualizar existentes baseado em email ou telefone.
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
              disabled={isImporting}
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer flex flex-col items-center gap-4"
            >
              {file ? (
                <>
                  <FileText className="h-12 w-12 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">
                      Clique para selecionar um arquivo CSV
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Máximo: 50 MB
                    </p>
                  </div>
                </>
              )}
            </label>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processando...</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="flex-1"
            >
              {isImporting ? 'Importando...' : 'Iniciar Importação'}
            </Button>
            {file && !isImporting && (
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setStats(null);
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Processado</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.created}</div>
                <div className="text-sm text-muted-foreground">Criados</div>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.updated}</div>
                <div className="text-sm text-muted-foreground">Atualizados</div>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">
                Tempo de processamento: <span className="font-medium text-foreground">{formatDuration(stats.duration)}</span>
              </div>
              {stats.errorDetails && stats.errorDetails.length > 0 && (
                <Button variant="outline" size="sm" onClick={downloadErrorLog}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Log de Erros
                </Button>
              )}
            </div>

            {stats.errors > 0 && stats.errorDetails && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {stats.errors} contato(s) não puderam ser importados. Baixe o log de erros para mais detalhes.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportarContatos;
