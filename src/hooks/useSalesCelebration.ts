import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CONFETTI_PRODUCTS, CONFETTI_EXCLUDE_PRODUCTS, CLOSER_LIST } from "@/constants/team";
import { useSdrsFromSquad } from "./useSdrsFromSquad";

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

const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-11);
};

export const useSalesCelebration = () => {
  const [celebrationQueue, setCelebrationQueue] = useState<SaleData[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<SaleData | null>(null);
  const celebratedSales = useRef<Set<string>>(getCelebratedSales());
  const initialLoadDone = useRef(false);

  // Fetch SDR list from database dynamically
  const sdrsQuery = useSdrsFromSquad("inside_sales");
  const sdrListRef = useRef<Array<{ nome: string; email: string }>>([]);

  // Keep ref in sync with query data
  useEffect(() => {
    if (sdrsQuery.data) {
      sdrListRef.current = sdrsQuery.data.map(s => ({
        nome: s.name,
        email: s.email || '',
      }));
    }
  }, [sdrsQuery.data]);

  const findContact = useCallback(async (transaction: any) => {
    if (transaction.customer_email) {
      const { data } = await supabase
        .from("crm_contacts")
        .select(`
          name, tags,
          crm_deals!crm_deals_contact_id_fkey(clint_id, custom_fields)
        `)
        .eq("email", transaction.customer_email)
        .single();
      
      if (data) return data;
    }

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
        
        const match = contacts?.find(c => {
          const contactPhone = normalizePhone(c.phone);
          return contactPhone && contactPhone.includes(phoneDigits.slice(-9));
        });
        
        if (match) return match;
      }
    }

    if (transaction.customer_name) {
      const nameParts = transaction.customer_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select(`
          name, tags,
          crm_deals!crm_deals_contact_id_fkey(clint_id, custom_fields)
        `)
        .ilike("name", `${firstName}%`)
        .limit(10);
      
      if (contacts && contacts.length > 0) {
        if (lastName && contacts.length > 1) {
          const exactMatch = contacts.find(c => 
            c.name.toLowerCase().includes(lastName.toLowerCase())
          );
          if (exactMatch) return exactMatch;
        }
        if (contacts.length === 1) return contacts[0];
      }
    }

    return null;
  }, []);

  const processTransaction = useCallback(async (transaction: any): Promise<SaleData | null> => {
    if (transaction.hubla_id?.startsWith('newsale-')) return null;

    const rawData = transaction.raw_data;
    const smartInstallment = rawData?.event?.invoice?.smartInstallment;
    if (smartInstallment && smartInstallment.installment > 1) return null;

    const productNameLower = transaction.product_name?.toLowerCase() || '';
    
    const hasExplicitMatch = CONFETTI_PRODUCTS.some((p) => {
      const pLower = p.toLowerCase();
      return pLower.length <= 10 && productNameLower.includes(pLower);
    });
    
    const isConfettiProduct = CONFETTI_PRODUCTS.some((p) =>
      productNameLower.includes(p.toLowerCase())
    );

    const isExcludedProduct = CONFETTI_EXCLUDE_PRODUCTS.some((p) =>
      productNameLower.includes(p.toLowerCase())
    );

    if (!isConfettiProduct || (isExcludedProduct && !hasExplicitMatch)) return null;

    if (celebratedSales.current.has(transaction.id)) return null;

    const contact = await findContact(transaction);

    if (!contact) {
      return {
        id: transaction.id,
        leadName: transaction.customer_name || "Lead",
        leadType: transaction.product_price >= 450 ? "A" : "B",
        sdrName: "-",
        closerName: "-",
        productName: transaction.product_name,
      };
    }

    const leadName = contact.name || transaction.customer_name || "Lead";
    
    let leadType: "A" | "B" = "B";
    if (Array.isArray(contact?.tags)) {
      const hasLeadA = contact.tags.some((tag: any) => 
        tag?.name?.toLowerCase()?.includes('lead a') || 
        String(tag).toLowerCase().includes('lead a')
      );
      if (hasLeadA) leadType = "A";
    }

    let sdrName = "SDR";
    let closerName = "Closer";
    const currentSdrList = sdrListRef.current;

    const deal = (contact as any)?.crm_deals?.[0];
    if (deal?.clint_id) {
      const { data: activities } = await supabase
        .from("deal_activities")
        .select("to_stage, metadata")
        .eq("deal_id", deal.clint_id)
        .in("to_stage", ["Reunião 01 Agendada", "Reunião 01 Realizada", "Reunião 02 Agendada", "Reunião 02 Realizada", "Contrato Pago"])
        .order("created_at", { ascending: true });

      const r1AgendadaActivity = activities?.find(a => a.to_stage === "Reunião 01 Agendada");
      const sdrCandidate = (r1AgendadaActivity?.metadata as any)?.deal_user_name;

      const r2AgendadaActivity = activities?.find(a => a.to_stage === "Reunião 02 Agendada");
      const r2RealizadaActivity = activities?.find(a => a.to_stage === "Reunião 02 Realizada");
      const contratoPagoActivity = activities?.find(a => a.to_stage === "Contrato Pago");
      
      const closerCandidate = 
        (r2RealizadaActivity?.metadata as any)?.deal_user_name ||
        (r2AgendadaActivity?.metadata as any)?.deal_user_name ||
        (contratoPagoActivity?.metadata as any)?.deal_closer ||
        (contratoPagoActivity?.metadata as any)?.deal_user_name;

      if (sdrCandidate) {
        const isValidSdr = currentSdrList.some(sdr => 
          sdr.nome.toLowerCase().includes(sdrCandidate.split(' ')[0].toLowerCase()) ||
          sdrCandidate.toLowerCase().includes(sdr.nome.split(' ')[0].toLowerCase())
        );
        
        const isActuallyCloser = CLOSER_LIST.some(closer => 
          closer.variations.some(v => sdrCandidate.toLowerCase().includes(v.toLowerCase()))
        );
        
        if (isValidSdr && !isActuallyCloser) {
          sdrName = sdrCandidate;
        }
      }

      if (closerCandidate) {
        const isValidCloser = CLOSER_LIST.some(closer => 
          closer.variations.some(v => closerCandidate.toLowerCase().includes(v.toLowerCase()))
        );
        
        const isActuallySdr = currentSdrList.some(sdr => 
          sdr.nome.toLowerCase() === closerCandidate.toLowerCase() ||
          closerCandidate.toLowerCase().includes(sdr.nome.split(' ')[0].toLowerCase())
        );
        
        if (isValidCloser && !isActuallySdr) {
          closerName = closerCandidate;
        }
      }

      if (sdrName === "SDR" || closerName === "Closer") {
        const customFields = deal?.custom_fields as any;
        const userName = customFields?.deal_user_name || customFields?.user_name;
        
        const isUserNameCloser = userName && CLOSER_LIST.some(closer => 
          closer.variations.some(v => userName.toLowerCase().includes(v.toLowerCase()))
        );
        
        if (isUserNameCloser && closerName === "Closer") {
          closerName = userName;
          if (sdrName === "SDR") sdrName = "-";
        } else if (sdrName === "SDR" && userName) {
          const isValidSdr = currentSdrList.some(sdr => 
            sdr.nome.toLowerCase().includes(userName.split(' ')[0].toLowerCase()) ||
            userName.toLowerCase().includes(sdr.nome.split(' ')[0].toLowerCase())
          );
          
          if (isValidSdr) {
            sdrName = userName;
          } else {
            sdrName = "-";
          }
        }
        
        if (closerName === "Closer") {
          const closerFallback = customFields?.deal_closer;
          if (closerFallback) {
            const isValidCloser = CLOSER_LIST.some(closer => 
              closer.variations.some(v => closerFallback.toLowerCase().includes(v.toLowerCase()))
            );
            if (isValidCloser) closerName = closerFallback;
          }
        }
      }
      
      if (sdrName === "SDR") sdrName = "-";
      if (closerName === "Closer") closerName = "-";
    }

    return {
      id: transaction.id,
      leadName,
      leadType,
      sdrName,
      closerName,
      productName: transaction.product_name,
    };
  }, [findContact]);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadTodaySales = async () => {
      const now = new Date();
      const todayBrazil = new Date(now);
      todayBrazil.setHours(todayBrazil.getHours() - 3);
      const todayStartBrazil = new Date(todayBrazil);
      todayStartBrazil.setHours(3, 0, 0, 0);

      const { data: todaySales } = await supabase
        .from("hubla_transactions")
        .select("*")
        .eq("sale_status", "completed")
        .gte("sale_date", todayStartBrazil.toISOString())
        .order("created_at", { ascending: true });

      const salesToCelebrate: SaleData[] = [];

      for (const sale of todaySales || []) {
        if (celebratedSales.current.has(sale.id)) continue;
        const saleData = await processTransaction(sale);
        if (saleData) salesToCelebrate.push(saleData);
      }

      if (salesToCelebrate.length > 0) {
        setCelebrationQueue(prev => [...prev, ...salesToCelebrate]);
      }
    };

    loadTodaySales();
  }, [processTransaction]);

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
          
          const saleDate = new Date(transaction.sale_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (saleDate < today) return;
          
          const saleData = await processTransaction(transaction);
          if (saleData) {
            setCelebrationQueue((prev) => [...prev, saleData]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [processTransaction]);

  useEffect(() => {
    if (!currentCelebration && celebrationQueue.length > 0) {
      const [nextSale, ...rest] = celebrationQueue;
      setCurrentCelebration(nextSale);
      setCelebrationQueue(rest);
      markAsCelebrated(nextSale.id);
      celebratedSales.current.add(nextSale.id);
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
