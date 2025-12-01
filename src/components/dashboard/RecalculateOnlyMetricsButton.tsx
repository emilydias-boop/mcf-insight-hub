import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function RecalculateOnlyMetricsButton() {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { toast } = useToast();

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    
    try {
      console.log('🔄 Iniciando recálculo de métricas...');
      
      // Buscar data mais antiga e mais recente
      const { data: minDateData } = await supabase
        .from('hubla_transactions')
        .select('sale_date')
        .order('sale_date', { ascending: true })
        .limit(1)
        .single();

      const { data: maxDateData } = await supabase
        .from('hubla_transactions')
        .select('sale_date')
        .order('sale_date', { ascending: false })
        .limit(1)
        .single();

      if (!minDateData || !maxDateData) {
        throw new Error('Não foi possível determinar o range de datas');
      }

      const startDate = new Date(minDateData.sale_date).toISOString().split('T')[0];
      const endDate = new Date(maxDateData.sale_date).toISOString().split('T')[0];

      console.log(`📅 Recalculando de ${startDate} até ${endDate}`);

      const { data, error } = await supabase.functions.invoke('recalculate-metrics', {
        body: {
          start_date: startDate,
          end_date: endDate,
        },
      });

      if (error) {
        throw error;
      }

      console.log('✅ Recálculo concluído:', data);
      
      toast({
        title: "✅ Métricas recalculadas!",
        description: `${data?.processed_weeks || 0} semanas processadas com sucesso.`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao recalcular métricas:', error);
      
      toast({
        title: "❌ Erro ao recalcular",
        description: error.message || "Não foi possível recalcular as métricas. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <Button
      onClick={handleRecalculate}
      disabled={isRecalculating}
      variant="outline"
      className="bg-blue-500/10 border-blue-500 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
    >
      <Calculator className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
      {isRecalculating ? 'Recalculando...' : 'Recalcular Métricas'}
    </Button>
  );
}
