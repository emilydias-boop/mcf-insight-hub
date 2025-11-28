import { useEffect, useState, useRef } from "react";
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
  const fetchedRetroactive = useRef(false);

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

    if (!isConfettiProduct) {
      return null;
    }

    // Verificar se já foi celebrada
    if (celebratedSales.current.has(transaction.id)) {
      console.log('✅ Já celebrada:', transaction.customer_name);
      return null;
    }

    console.log('🎯 Processando venda:', transaction.customer_name, '|', transaction.product_name);

    // Buscar informações do lead no CRM (com o deal relacionado)
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select(`
        name, 
        custom_fields, 
        tags,
        crm_deals!crm_deals_contact_id_fkey(custom_fields)
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

    // Buscar SDR e Closer dos custom_fields do deal
    const deal = (contact as any)?.crm_deals?.[0];
    const dealCustomFields = deal?.custom_fields as any;
    
    const sdrName = dealCustomFields?.user_name 
      || dealCustomFields?.deal_user_name 
      || "SDR";
    
    const closerName = dealCustomFields?.deal_closer || "Closer";

    console.log('👤 SDR encontrado:', sdrName);
    console.log('🎯 Closer encontrado:', closerName);

    return {
      id: transaction.id,
      leadName,
      leadType,
      sdrName,
      closerName,
      productName: transaction.product_name,
    };
  };

  // Buscar vendas retroativas ao carregar
  useEffect(() => {
    if (fetchedRetroactive.current) return;
    fetchedRetroactive.current = true;

    const fetchRetractiveSales = async () => {
      console.log('📊 Buscando vendas retroativas de hoje...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: transactions, error } = await supabase
        .from("hubla_transactions")
        .select("*")
        .eq("sale_status", "completed")
        .gte("sale_date", today.toISOString())
        .order("sale_date", { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar vendas:', error);
        return;
      }

      console.log(`📦 Encontradas ${transactions?.length || 0} transações de hoje`);

      const salesToCelebrate: SaleData[] = [];
      
      for (const transaction of transactions || []) {
        const saleData = await processTransaction(transaction);
        if (saleData) {
          salesToCelebrate.push(saleData);
        }
      }

      console.log(`🎊 ${salesToCelebrate.length} vendas para celebrar`);
      
      if (salesToCelebrate.length > 0) {
        setCelebrationQueue((prev) => [...prev, ...salesToCelebrate]);
      }
    };

    fetchRetractiveSales();
  }, []);

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
          
          const saleData = await processTransaction(payload.new as any);
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
