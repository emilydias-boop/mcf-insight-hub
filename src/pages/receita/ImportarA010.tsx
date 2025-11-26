import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ImportarA010() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: number; total: number } | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    try {
      setIsImporting(true);
      setResult(null);

      // Fetch CSV from public folder
      const response = await fetch('/a010-sales-import.csv');
      const csvData = await response.text();

      console.log('CSV loaded, calling import function...');

      // Call edge function
      const { data, error } = await supabase.functions.invoke('import-a010-sales', {
        body: { csvData }
      });

      if (error) throw error;

      console.log('Import result:', data);

      setResult(data);

      toast({
        title: "Importação concluída!",
        description: `${data.inserted} vendas importadas com sucesso.`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importar Dados A010</CardTitle>
          <CardDescription>
            Importar vendas do curso A010 a partir do arquivo CSV já carregado no projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed rounded-lg bg-muted/30">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Arquivo CSV pronto para importação: <strong>a010-sales-import.csv</strong>
              </p>
              <Button 
                onClick={handleImport} 
                disabled={isImporting}
                size="lg"
              >
                {isImporting ? "Importando..." : "Iniciar Importação"}
              </Button>
            </div>
          </div>

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">
                  {result.inserted} vendas importadas com sucesso
                </span>
              </div>
              
              {result.errors > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>
                    {result.errors} erros durante a importação
                  </span>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Total de registros processados: {result.total}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
