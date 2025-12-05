import { useEffect, useState, useRef, useCallback } from "react";
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

// Normalizar telefone para comparação (apenas últimos 11 dígitos)
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-11);
};

export const useSalesCelebration = () => {
  const [celebrationQueue, setCelebrationQueue] = useState<SaleData[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<SaleData | null>(null);
  const celebratedSales = useRef<Set<string>>(getCelebratedSales());
  const initialLoadDone = useRef(false);

  // Função para buscar contato por email, telefone ou nome
  const findContact = useCallback(async (transaction: any) => {
    // 1. Tentar por email
    if (transaction.customer_email) {
      const { data } = await supabase
        .from("crm_contacts")
        .select(`
          name, tags,
          crm_deals!crm_deals_contact_id_fkey(clint_id, custom_fields)
        `)
        .eq("email", transaction.customer_email)
        .single();
      
      if (data) {
        console.log('📧 Contato encontrado por email:', data.name);
        return data;
      }
    }

    // 2. Tentar por telefone (normalizado)
    if (transaction.customer_phone) {
      const phoneDigits = normalizePhone(transaction.customer_phone);
      if (phoneDigits.length >= 10) {
        const { data: contacts } = await supabase
          .from("crm_contacts")
          .select(`
            name, tags, phone,
            crm_deals!crm_deals_contact_id_fkey(clint_id, custom_fields)
          `)
          .not("phone", "is", null);
        
        // Buscar match por telefone normalizado
        const match = contacts?.find(c => {
          const contactPhone = normalizePhone(c.phone);
          return contactPhone && contactPhone.includes(phoneDigits.slice(-9));
        });
        
        if (match) {
          console.log('📱 Contato encontrado por telefone:', match.name);
          return match;
        }
      }
    }

    // 3. Tentar por nome (match parcial)
    if (transaction.customer_name) {
      const nameParts = transaction.customer_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      
      // Buscar por primeiro nome
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select(`
          name, tags,
          crm_deals!crm_deals_contact_id_fkey(clint_id, custom_fields)
        `)
        .ilike("name", `${firstName}%`)
        .limit(10);
      
      // Se tiver sobrenome, filtrar mais
      if (contacts && contacts.length > 0) {
        if (lastName && contacts.length > 1) {
          const exactMatch = contacts.find(c => 
            c.name.toLowerCase().includes(lastName.toLowerCase())
          );
          if (exactMatch) {
            console.log('👤 Contato encontrado por nome completo:', exactMatch.name);
            return exactMatch;
          }
        }
        // Usar o primeiro resultado se só tiver um
        if (contacts.length === 1) {
          console.log('👤 Contato encontrado por primeiro nome:', contacts[0].name);
          return contacts[0];
        }
      }
    }

    return null;
  }, []);

  // Função para processar uma transação
  const processTransaction = useCallback(async (transaction: any): Promise<SaleData | null> => {
    // 🚫 Ignorar transações newsale-xxx (duplicatas sem dados completos)
    if (transaction.hubla_id?.startsWith('newsale-')) {
      console.log('⏭️ Ignorando newsale duplicata:', transaction.hubla_id);
      return null;
    }

    // 🚫 Ignorar recorrências (parcela > 1)
    const rawData = transaction.raw_data;
    const smartInstallment = rawData?.event?.invoice?.smartInstallment;
    if (smartInstallment && smartInstallment.installment > 1) {
      console.log('🔇 Ignorando recorrência:', transaction.customer_name);
      return null;
    }

    // Verificar se é produto de confetti
    const productNameLower = transaction.product_name?.toLowerCase() || '';
    
    // Verificar match explícito (A009, etc) - tem prioridade sobre exclusões
    const hasExplicitMatch = CONFETTI_PRODUCTS.some((p) => {
      const pLower = p.toLowerCase();
      // Match explícito = padrão curto (ex: "A009", "Contrato") que é código/identificador
      return pLower.length <= 10 && productNameLower.includes(pLower);
    });
    
    const isConfettiProduct = CONFETTI_PRODUCTS.some((p) =>
      productNameLower.includes(p.toLowerCase())
    );

    // Verificar se está na lista de exclusão
    const isExcludedProduct = CONFETTI_EXCLUDE_PRODUCTS.some((p) =>
      productNameLower.includes(p.toLowerCase())
    );

    // Se tem match explícito (ex: A009), celebrar mesmo que tenha exclusão
    // Caso contrário, excluir se estiver na lista de exclusão
    if (!isConfettiProduct || (isExcludedProduct && !hasExplicitMatch)) {
      if (isExcludedProduct && !hasExplicitMatch) {
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

    // Buscar contato usando cascata: email → telefone → nome
    const contact = await findContact(transaction);

    if (!contact) {
      console.log('⚠️ Contato não encontrado no CRM:', transaction.customer_name, transaction.customer_email);
      // Mesmo sem contato, celebrar com dados básicos
      return {
        id: transaction.id,
        leadName: transaction.customer_name || "Lead",
        leadType: transaction.product_price >= 450 ? "A" : "B",
        sdrName: "-",
        closerName: "-",
        productName: transaction.product_name,
      };
    }

    // Extrair informações
    const leadName = contact.name || transaction.customer_name || "Lead";
    
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
  }, [findContact]);

  // Carregar vendas do dia ao iniciar (para celebrar retroativamente)
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadTodaySales = async () => {
      // Calcular início do dia no timezone brasileiro (UTC-3)
      const now = new Date();
      const todayBrazil = new Date(now);
      todayBrazil.setHours(todayBrazil.getHours() - 3);
      const todayStartBrazil = new Date(todayBrazil);
      todayStartBrazil.setHours(3, 0, 0, 0); // 00:00 Brasil = 03:00 UTC

      console.log('📋 Carregando vendas do dia desde:', todayStartBrazil.toISOString());

      const { data: todaySales } = await supabase
        .from("hubla_transactions")
        .select("*")
        .eq("sale_status", "completed")
        .gte("sale_date", todayStartBrazil.toISOString())
        .order("created_at", { ascending: true });

      console.log('📋 Vendas do dia encontradas:', todaySales?.length);

      const salesToCelebrate: SaleData[] = [];

      for (const sale of todaySales || []) {
        // Verificar se já foi celebrada
        if (celebratedSales.current.has(sale.id)) {
          console.log('✅ Já celebrada anteriormente:', sale.customer_name);
          continue;
        }

        const saleData = await processTransaction(sale);
        if (saleData) {
          salesToCelebrate.push(saleData);
        }
      }

      if (salesToCelebrate.length > 0) {
        console.log('🎉 Vendas para celebrar:', salesToCelebrate.length);
        setCelebrationQueue(prev => [...prev, ...salesToCelebrate]);
      }
    };

    loadTodaySales();
  }, [processTransaction]);

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
  }, [processTransaction]);

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