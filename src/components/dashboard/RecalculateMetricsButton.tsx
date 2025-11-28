import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = 'metrics_recalculated';

export function RecalculateMetricsButton() {
  const [isRecalculated, setIsRecalculated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const recalculated = localStorage.getItem(STORAGE_KEY) === 'true';
    setIsRecalculated(recalculated);
  }, []);

  if (isRecalculated) {
    return null;
  }

  const handleRecalculate = async () => {
    setIsLoading(true);
    
    try {
      console.log('📊 Iniciando recálculo de todas as métricas...');
      
      const { data, error } = await supabase.functions.invoke('recalculate-metrics', {
        body: {
          start_date: '2024-06-01',
          end_date: '2025-11-28',
        },
      });

      if (error) {
        throw error;
      }

      // Verificar se houve erros no processamento interno
      if (data?.errors > 0) {
        throw new Error(`Falha no recálculo: ${data.errors} erros de ${data.total} semanas`);
      }

      console.log('✅ Recálculo concluído:', data);
      
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsRecalculated(true);
      
      toast({
        title: "✅ Métricas recalculadas!",
        description: `${data?.processed || 0} semanas processadas com sucesso. Este botão não aparecerá mais.`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao recalcular métricas:', error);
      
      toast({
        title: "❌ Erro ao recalcular",
        description: error.message || "Não foi possível recalcular as métricas. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleRecalculate}
      disabled={isLoading}
      variant="outline"
      className="bg-yellow-500/10 border-yellow-500 text-yellow-600 hover:bg-yellow-500/20 dark:text-yellow-400"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Recalculando...' : 'Recalcular Métricas'}
    </Button>
  );
}
