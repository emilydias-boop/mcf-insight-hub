import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CONFETTI_PRODUCTS } from "@/constants/team";

interface SaleData {
  id: string;
  leadName: string;
  leadType: "A" | "B";
  sdrName: string;
  closerName: string;
  productName: string;
}

export const useSalesCelebration = () => {
  const [celebrationQueue, setCelebrationQueue] = useState<SaleData[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<SaleData | null>(null);

  // Escutar novas vendas via Realtime
  useEffect(() => {
    const channel = supabase
      .channel("hubla-sales")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hubla_transactions",
          filter: `sale_status=eq.completed`,
        },
        async (payload) => {
          const transaction = payload.new as any;

          // 🚫 Ignorar recorrências (parcela > 1)
          const rawData = transaction.raw_data;
          const smartInstallment = rawData?.event?.invoice?.smartInstallment;
          if (smartInstallment && smartInstallment.installment > 1) {
            console.log('🔇 Ignorando recorrência - parcela:', smartInstallment.installment);
            return;
          }

          // Verificar se é produto de confetti
          const isConfettiProduct = CONFETTI_PRODUCTS.some((p) =>
            transaction.product_name?.toLowerCase().includes(p.toLowerCase())
          );

          if (!isConfettiProduct) return;

          // Buscar informações do lead no CRM
          const { data: contact } = await supabase
            .from("crm_contacts")
            .select("name, custom_fields, crm_deals(custom_fields)")
            .eq("email", transaction.customer_email)
            .single();

          if (!contact) return;

          // Extrair informações
          const leadName = contact.name || "Lead";
          const customFields = contact.custom_fields as any;
          const leadType = customFields?.tipo_lead === "A" ? "A" : "B";
          const sdrName = customFields?.user_email || "SDR Desconhecido";
          
          // Buscar closer (última atividade R1 Realizada)
          const { data: lastActivity } = await supabase
            .from("deal_activities")
            .select("metadata")
            .eq("activity_type", "stage_change")
            .eq("to_stage", "R1 Realizada")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const activityMetadata = lastActivity?.metadata as any;
          const closerName = activityMetadata?.closer_name || "Closer Desconhecido";

          const saleData: SaleData = {
            id: transaction.id,
            leadName,
            leadType,
            sdrName,
            closerName,
            productName: transaction.product_name,
          };

          setCelebrationQueue((prev) => [...prev, saleData]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Processar fila de celebrações
  useEffect(() => {
    if (!currentCelebration && celebrationQueue.length > 0) {
      const [nextSale, ...rest] = celebrationQueue;
      setCurrentCelebration(nextSale);
      setCelebrationQueue(rest);
    }
  }, [currentCelebration, celebrationQueue]);

  const handleCelebrationComplete = () => {
    setCurrentCelebration(null);
  };

  return {
    currentCelebration,
    handleCelebrationComplete,
  };
};
