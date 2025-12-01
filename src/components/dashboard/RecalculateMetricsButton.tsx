import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = 'orderbumps_fixed_v3'; // Incrementado para permitir nova execução

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
      console.log('🔧 Etapa 1: Corrigindo Order Bumps históricos...');
      
      const { data, error } = await supabase.functions.invoke('fix-csv-orderbumps');

      if (error) {
        throw error;
      }

      // Verificar se houve erros no processamento
      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('✅ Correção concluída:', data);
      
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsRecalculated(true);
      
      toast({
        title: "✅ Correção concluída!",
        description: `${data?.summary?.correctedTransactions || 0} transações corrigidas, ${data?.summary?.createdOrderBumps || 0} Order Bumps criados. Métricas recalculadas automaticamente.`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao corrigir Order Bumps:', error);
      
      toast({
        title: "❌ Erro ao corrigir",
        description: error.message || "Não foi possível corrigir os Order Bumps. Tente novamente.",
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
      {isLoading ? 'Corrigindo OBs e Recalculando...' : 'Corrigir OBs e Recalcular'}
    </Button>
  );
}
