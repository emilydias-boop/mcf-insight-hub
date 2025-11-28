import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CONFETTI_PRODUCTS, CONFETTI_EXCLUDE_PRODUCTS, SDR_LIST, CLOSER_LIST } from "@/constants/team";

interface SaleData {
  id: string;
  leadName: string;
  leadType: "A" | "B";
  sdrName: string;
  closerName: string;
  productName: string;
}

// Chave para armazenar IDs de vendas já celebradas
const CELEBRATED_SALES_KEY = 'celebrated_sales';

const getCelebratedSales = (): Set<string> => {
  try {
    const stored = localStorage.getItem(CELEBRATED_SALES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Limpar vendas com mais de 24h
      const now = Date.now();
      const filtered = Object.entries(parsed)
        .filter(([_, timestamp]) => now - (timestamp as number) < 24 * 60 * 60 * 1000);
      return new Set(filtered.map(([id]) => id));
    }
  } catch {}
  return new Set();
};

const markAsCelebrated = (saleId: string) => {
  try {
    const stored = localStorage.getItem(CELEBRATED_SALES_KEY);
    const sales = stored ? JSON.parse(stored) : {};
    sales[saleId] = Date.now();
    localStorage.setItem(CELEBRATED_SALES_KEY, JSON.stringify(sales));
  } catch {}
};

export const useSalesCelebration = () => {
  const [celebrationQueue, setCelebrationQueue] = useState<SaleData[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<SaleData | null>(null);
  const celebratedSales = useRef<Set<string>>(getCelebratedSales());

  // Função para processar uma transação
  const processTransaction = async (transaction: any): Promise<SaleData | null> => {
    // 🚫 Ignorar recorrências (parcela > 1)
    const rawData = transaction.raw_data;
    const smartInstallment = rawData?.event?.invoice?.smartInstallment;
    if (smartInstallment && smartInstallment.installment > 1) {
      console.log('🔇 Ignorando recorrência:', transaction.customer_name);
      return null;
    }

    // Verificar se é produto de confetti
    const isConfettiProduct = CONFETTI_PRODUCTS.some((p) =>
      transaction.product_name?.toLowerCase().includes(p.toLowerCase())
    );

    // Verificar se está na lista de exclusão
    const isExcludedProduct = CONFETTI_EXCLUDE_PRODUCTS.some((p) =>
      transaction.product_name?.toLowerCase().includes(p.toLowerCase())
    );

    if (!isConfettiProduct || isExcludedProduct) {
      if (isExcludedProduct) {
        console.log('🚫 Produto excluído:', transaction.product_name);
      }
      return null;
    }

    // Verificar se já foi celebrada
    if (celebratedSales.current.has(transaction.id)) {
      console.log('✅ Já celebrada:', transaction.customer_name);
      return null;
    }

    console.log('🎯 Processando venda:', transaction.customer_name, '|', transaction.product_name);

    // Buscar informações do lead no CRM (com o deal relacionado e custom_fields)
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select(`
        name, 
        tags,
        crm_deals!crm_deals_contact_id_fkey(clint_id, custom_fields)
      `)
      .eq("email", transaction.customer_email)
      .single();

    if (!contact) {
      console.log('⚠️ Contato não encontrado no CRM:', transaction.customer_email);
      return null;
    }

    // Extrair informações
    const leadName = contact.name || "Lead";
    
    // Determinar tipo de lead baseado em tags
    let leadType: "A" | "B" = "B";
    if (Array.isArray(contact?.tags)) {
      const hasLeadA = contact.tags.some((tag: any) => 
        tag?.name?.toLowerCase()?.includes('lead a') || 
        String(tag).toLowerCase().includes('lead a')
      );
      if (hasLeadA) leadType = "A";
    }

    // Buscar SDR e Closer das atividades do deal
    let sdrName = "SDR";
    let closerName = "Closer";

    const deal = (contact as any)?.crm_deals?.[0];
    if (deal?.clint_id) {
      const { data: activities } = await supabase
        .from("deal_activities")
        .select("to_stage, metadata")
        .eq("deal_id", deal.clint_id)
        .in("to_stage", ["Reunião 01 Agendada", "Reunião 01 Realizada", "Reunião 02 Agendada", "Reunião 02 Realizada", "Contrato Pago"])
        .order("created_at", { ascending: true });

      // Candidato a SDR = quem moveu para R1 Agendada
      const r1AgendadaActivity = activities?.find(a => a.to_stage === "Reunião 01 Agendada");
      const sdrCandidate = (r1AgendadaActivity?.metadata as any)?.deal_user_name;

      // Candidato a Closer = quem moveu para R2 Agendada/Realizada (prioridade) ou Contrato Pago
      const r2AgendadaActivity = activities?.find(a => a.to_stage === "Reunião 02 Agendada");
      const r2RealizadaActivity = activities?.find(a => a.to_stage === "Reunião 02 Realizada");
      const contratoPagoActivity = activities?.find(a => a.to_stage === "Contrato Pago");
      
      const closerCandidate = 
        (r2RealizadaActivity?.metadata as any)?.deal_user_name ||
        (r2AgendadaActivity?.metadata as any)?.deal_user_name ||
        (contratoPagoActivity?.metadata as any)?.deal_closer ||
        (contratoPagoActivity?.metadata as any)?.deal_user_name;

      // Validar SDR contra lista
      if (sdrCandidate) {
        const isValidSdr = SDR_LIST.some(sdr => 
          sdr.nome.toLowerCase().includes(sdrCandidate.split(' ')[0].toLowerCase()) ||
          sdrCandidate.toLowerCase().includes(sdr.nome.split(' ')[0].toLowerCase())
        );
        
        // Verificar se não é na verdade um Closer
        const isActuallyCloser = CLOSER_LIST.some(closer => 
          closer.variations.some(v => sdrCandidate.toLowerCase().includes(v.toLowerCase()))
        );
        
        if (isValidSdr && !isActuallyCloser) {
          sdrName = sdrCandidate;
        }
      }

      // Validar Closer contra lista
      if (closerCandidate) {
        const isValidCloser = CLOSER_LIST.some(closer => 
          closer.variations.some(v => closerCandidate.toLowerCase().includes(v.toLowerCase()))
        );
        
        // Se não é Closer válido, pode ser que seja um SDR no lugar errado
        const isActuallySdr = SDR_LIST.some(sdr => 
          sdr.nome.toLowerCase() === closerCandidate.toLowerCase() ||
          closerCandidate.toLowerCase().includes(sdr.nome.split(' ')[0].toLowerCase())
        );
        
        if (isValidCloser && !isActuallySdr) {
          closerName = closerCandidate;
        }
      }

      // Fallback: buscar em custom_fields se não encontrou nas atividades
      if (sdrName === "SDR" || closerName === "Closer") {
        const customFields = deal?.custom_fields as any;
        const userName = customFields?.deal_user_name || customFields?.user_name;
        
        // Verificar se user_name é um Closer
        const isUserNameCloser = userName && CLOSER_LIST.some(closer => 
          closer.variations.some(v => userName.toLowerCase().includes(v.toLowerCase()))
        );
        
        // Se user_name é Closer, usar como Closer e deixar SDR vazio
        if (isUserNameCloser && closerName === "Closer") {
          closerName = userName;
          if (sdrName === "SDR") {
            sdrName = "-";
          }
        }
        // Se não é Closer, tentar usar como SDR
        else if (sdrName === "SDR" && userName) {
          const isValidSdr = SDR_LIST.some(sdr => 
            sdr.nome.toLowerCase().includes(userName.split(' ')[0].toLowerCase()) ||
            userName.toLowerCase().includes(sdr.nome.split(' ')[0].toLowerCase())
          );
          
          if (isValidSdr) {
            sdrName = userName;
          } else {
            sdrName = "-";
          }
        }
        
        // Fallback separado para deal_closer
        if (closerName === "Closer") {
          const closerFallback = customFields?.deal_closer;
          if (closerFallback) {
            const isValidCloser = CLOSER_LIST.some(closer => 
              closer.variations.some(v => closerFallback.toLowerCase().includes(v.toLowerCase()))
            );
            if (isValidCloser) {
              closerName = closerFallback;
            }
          }
        }
      }
      
      // Se ainda ficou genérico, usar "-"
      if (sdrName === "SDR") sdrName = "-";
      if (closerName === "Closer") closerName = "-";
    }

    console.log('👤 SDR validado:', sdrName);
    console.log('🎯 Closer validado:', closerName);

    return {
      id: transaction.id,
      leadName,
      leadType,
      sdrName,
      closerName,
      productName: transaction.product_name,
    };
  };

  // Escutar novas vendas via Realtime
  useEffect(() => {
    console.log('📡 Iniciando escuta Realtime de vendas...');
    
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
          console.log('🔔 Nova transação recebida via Realtime:', payload.new);
          
          const transaction = payload.new as any;
          
          // 🔒 Verificar se a venda é de hoje (não histórica)
          const saleDate = new Date(transaction.sale_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (saleDate < today) {
            console.log('⏭️ Ignorando venda histórica:', transaction.customer_name, '| Data:', transaction.sale_date);
            return;
          }
          
          const saleData = await processTransaction(transaction);
          if (saleData) {
            setCelebrationQueue((prev) => [...prev, saleData]);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status Realtime:', status);
      });

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
      
      // Marcar como celebrada
      markAsCelebrated(nextSale.id);
      celebratedSales.current.add(nextSale.id);
      
      console.log('🎉 Celebrando:', nextSale.leadName, '|', nextSale.productName, `| Fila: ${rest.length}`);
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
