import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { endOfDay, format } from 'date-fns';
import { getCachedPrecoReferencia } from './useProductPricesCache';

// Helper para normalização consistente (apenas dígitos, últimos 11)
const normalizeForMatch = (phone: string | null): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, '').slice(-11);
};

// Helper para obter preço de referência dinamicamente do cache (product_configurations)
const getProductReferencePrice = (productName: string | null): number | null => {
  if (!productName) return null;
  const upper = productName.toUpperCase();
  // P2 sempre usa valor real (não tem preço de referência fixo)
  if (upper.includes('A005') || upper.includes('P2')) return 0;
  
  const cached = getCachedPrecoReferencia(productName);
  if (cached > 0) return cached;
  
  return null;
};

export interface R2CarrinhoVenda {
  id: string;
  hubla_id: string;
  product_name: string | null;
  product_price: number | null;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string;
  installment_number: number | null;
  total_installments: number | null;
  source: string | null;
  gross_override: number | null;
  count_in_dashboard: boolean | null;
  excluded_from_cart: boolean | null;
  linked_attendee_id: string | null;
  // Dados do lead R2
  r2_attendee_name: string | null;
  r2_closer_name: string | null;
  r2_closer_color: string | null;
  // Flag indicando se foi match manual ou automático
  is_manual_link: boolean;
  // Campos para agrupamento de transações (P1 + P2)
  has_p2?: boolean;
  p2_count?: number;
  p2_total?: number;
  consolidated_gross?: number;
  related_transactions?: R2CarrinhoVenda[];
  // Preço de referência enriquecido do Hubla
  enriched_reference_price?: number;
  // Flag para vendas de semanas anteriores (extras)
  is_extra?: boolean;
  original_week_start?: string;
  original_scheduled_at?: string;
}

export function useR2CarrinhoVendas(weekStart: Date, weekEnd: Date) {

  return useQuery({
    queryKey: ['r2-carrinho-vendas', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      // 1. Buscar attendees aprovados da semana com dados do closer
      const { data: approvedAttendees, error: attendeesError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          meeting_slot:meeting_slots!inner (
            id,
            scheduled_at,
            meeting_type,
            closer:closers (
              id,
              name,
              color
            )
          ),
          deal:crm_deals (
            id,
            contact:crm_contacts (
              email,
              phone
            )
          )
        `)
      .gte('meeting_slot.scheduled_at', weekStart.toISOString())
      .lte('meeting_slot.scheduled_at', endOfDay(weekEnd).toISOString())
        .eq('meeting_slot.meeting_type', 'r2')
        .eq('r2_status_id', '24d9a326-378b-4191-a4b3-d0ec8b9d23eb');

      if (attendeesError) throw attendeesError;

      if (!approvedAttendees || approvedAttendees.length === 0) {
        return [];
      }

      // 2. Coletar emails e telefones normalizados dos aprovados
      const emailsSet = new Set<string>();
      const phonesSet = new Set<string>();
      const attendeeMap = new Map<string, { name: string | null; closerName: string | null; closerColor: string | null }>();

      approvedAttendees.forEach((att: any) => {
        const email = att.deal?.contact?.email?.toLowerCase();
        const phone = att.attendee_phone || att.deal?.contact?.phone;
        const normalizedPhone = phone ? normalizeForMatch(phone) : null;
        
        const closerData = {
          name: att.attendee_name,
          closerName: att.meeting_slot?.closer?.name || null,
          closerColor: att.meeting_slot?.closer?.color || null,
        };

        if (email) {
          emailsSet.add(email);
          attendeeMap.set(email, closerData);
        }
        if (normalizedPhone && normalizedPhone.length >= 10) {
          phonesSet.add(normalizedPhone);
          attendeeMap.set(normalizedPhone, closerData);
        }
      });

      const emails = Array.from(emailsSet);
      const phones = Array.from(phonesSet);

      if (emails.length === 0 && phones.length === 0) {
        return [];
      }

      // 3. Buscar transações de parceria da semana que matcham com os leads aprovados
      // Matching por email/telefone já garante relevância - não filtrar por product_name
      let query = supabase
        .from('hubla_transactions')
        .select('*')
        .eq('product_category', 'parceria')
        .gte('sale_date', weekStart.toISOString())
        .lte('sale_date', endOfDay(weekEnd).toISOString())
        .order('sale_date', { ascending: false });

      // Construir filtro OR para emails e telefones
      const orFilters: string[] = [];
      
      if (emails.length > 0) {
        orFilters.push(`customer_email.in.(${emails.join(',')})`);
      }

      // Para telefones, vamos buscar todas as transações de parceria e filtrar no cliente
      const { data: transactions, error: txError } = await query;

      if (txError) throw txError;

      if (!transactions || transactions.length === 0) {
        return [];
      }

      // 4. Buscar attendees que foram vinculados manualmente
      const linkedAttendeeIds = transactions
        .filter((tx: any) => tx.linked_attendee_id)
        .map((tx: any) => tx.linked_attendee_id);

      let linkedAttendeesMap = new Map<string, { name: string | null; closerName: string | null; closerColor: string | null; scheduledAt: string | null }>();

      if (linkedAttendeeIds.length > 0) {
        const { data: linkedAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id,
            attendee_name,
            meeting_slot:meeting_slots!inner (
              scheduled_at,
              closer:closers (
                name,
                color
              )
            )
          `)
          .in('id', linkedAttendeeIds);

        linkedAttendees?.forEach((att: any) => {
          linkedAttendeesMap.set(att.id, {
            name: att.attendee_name,
            closerName: att.meeting_slot?.closer?.name || null,
            closerColor: att.meeting_slot?.closer?.color || null,
            scheduledAt: att.meeting_slot?.scheduled_at || null,
          });
        });
      }

      // 5. Filtrar transações que matcham por email, telefone OU vinculação manual
      const matchedTransactions: R2CarrinhoVenda[] = [];

      transactions.forEach((tx: any) => {
        const txEmail = tx.customer_email?.toLowerCase();
        const txPhone = tx.customer_phone ? normalizeForMatch(tx.customer_phone) : null;

        let matched = false;
        let isManualLink = false;
        let attendeeData: { name: string | null; closerName: string | null; closerColor: string | null; scheduledAt?: string | null } | undefined;
        let linkedScheduledAt: string | null = null;

        // Match por email
        if (txEmail && emailsSet.has(txEmail)) {
          matched = true;
          attendeeData = attendeeMap.get(txEmail);
        }

        // Match por telefone (comparação exata após normalização)
        if (!matched && txPhone && txPhone.length >= 10) {
          if (phonesSet.has(txPhone)) {
            matched = true;
            attendeeData = attendeeMap.get(txPhone);
          }
        }

        // Match manual (linked_attendee_id) - pode ser de outra semana
        if (!matched && tx.linked_attendee_id) {
          const linkedData = linkedAttendeesMap.get(tx.linked_attendee_id);
          if (linkedData) {
            matched = true;
            isManualLink = true;
            attendeeData = linkedData;
            linkedScheduledAt = linkedData.scheduledAt;
          }
        }

        if (matched) {
          // Calcular se é uma venda "extra" (R2 foi em outra semana)
          let isExtra = false;
          let originalWeekStart: string | undefined;
          let originalScheduledAt: string | undefined;

          if (linkedScheduledAt) {
            const linkedWeekStart = getCustomWeekStart(new Date(linkedScheduledAt));
            if (linkedWeekStart.getTime() !== weekStart.getTime()) {
              isExtra = true;
              originalWeekStart = format(linkedWeekStart, 'yyyy-MM-dd');
              originalScheduledAt = linkedScheduledAt;
            }
          }

          matchedTransactions.push({
            id: tx.id,
            hubla_id: tx.hubla_id,
            product_name: tx.product_name,
            product_price: tx.product_price,
            net_value: tx.net_value,
            customer_name: tx.customer_name,
            customer_email: tx.customer_email,
            customer_phone: tx.customer_phone,
            sale_date: tx.sale_date,
            installment_number: tx.installment_number,
            total_installments: tx.total_installments,
            source: tx.source,
            gross_override: tx.gross_override,
            count_in_dashboard: tx.count_in_dashboard,
            excluded_from_cart: tx.excluded_from_cart,
            linked_attendee_id: tx.linked_attendee_id,
            r2_attendee_name: attendeeData?.name || null,
            r2_closer_name: attendeeData?.closerName || null,
            r2_closer_color: attendeeData?.closerColor || null,
            is_manual_link: isManualLink,
            is_extra: isExtra,
            original_week_start: originalWeekStart,
            original_scheduled_at: originalScheduledAt,
          });
        }
      });

      // 5.5 Enriquecer transações genéricas "Parceria" com dados do Hubla
      // Identificar transações genéricas que precisam de enriquecimento
      const genericTransactions = matchedTransactions.filter(
        tx => tx.product_name?.toLowerCase().trim() === 'parceria'
      );

      if (genericTransactions.length > 0) {
        // Buscar emails únicos das transações genéricas
        const emailsToEnrich = [...new Set(
          genericTransactions
            .map(tx => tx.customer_email?.toLowerCase())
            .filter(Boolean) as string[]
        )];

        if (emailsToEnrich.length > 0) {
          // Buscar transações correspondentes no Hubla com nomes de produto corretos
          const { data: hublaMatches } = await supabase
            .from('hubla_transactions')
            .select('customer_email, product_name, product_price, sale_date')
            .in('customer_email', emailsToEnrich)
            .eq('source', 'hubla')
            .gte('sale_date', weekStart.toISOString())
            .lte('sale_date', endOfDay(weekEnd).toISOString());

          // Criar mapa de email -> produto correto (priorizar A009, depois A001, etc.)
          const hublaProductMap = new Map<string, { product_name: string; reference_price: number }>();
          
          // Ordenar para priorizar produtos com código identificável
          const sortedMatches = (hublaMatches || []).sort((a, b) => {
            const aName = a.product_name?.toUpperCase() || '';
            const bName = b.product_name?.toUpperCase() || '';
            // Priorizar A009 > A001 > A004 > A003 > outros
            const getPriority = (name: string) => {
              if (name.includes('A009')) return 1;
              if (name.includes('A001')) return 2;
              if (name.includes('A004')) return 3;
              if (name.includes('A003')) return 4;
              return 5;
            };
            return getPriority(aName) - getPriority(bName);
          });
          
          sortedMatches.forEach(match => {
            const email = match.customer_email?.toLowerCase();
            const productName = match.product_name || '';
            
            // Só enriquecer se encontrar um produto com código válido
            const referencePrice = getProductReferencePrice(productName);
            
            if (email && referencePrice !== null && !hublaProductMap.has(email)) {
              hublaProductMap.set(email, {
                product_name: productName,
                reference_price: referencePrice
              });
            }
          });

          // Enriquecer transações genéricas com dados do Hubla
          matchedTransactions.forEach(tx => {
            if (tx.product_name?.toLowerCase().trim() === 'parceria') {
              const email = tx.customer_email?.toLowerCase();
              if (email) {
                const hublaData = hublaProductMap.get(email);
                if (hublaData) {
                  tx.product_name = hublaData.product_name;
                  tx.enriched_reference_price = hublaData.reference_price;
                }
              }
            }
          });
        }
      }

      // 6. Agrupar transações por cliente para consolidar P1 + P2
      const groupedByClient = new Map<string, R2CarrinhoVenda[]>();

      matchedTransactions.forEach(tx => {
        const key = tx.customer_email?.toLowerCase() || tx.id;
        const group = groupedByClient.get(key) || [];
        group.push(tx);
        groupedByClient.set(key, group);
      });

      // 7. Consolidar grupos - identificar produto principal e somar valores
      const consolidatedVendas: R2CarrinhoVenda[] = [];

      groupedByClient.forEach((txGroup) => {
        // Encontrar o produto principal (A001, A009, A003, A004 - não P2)
        const mainProduct = txGroup.find(tx => {
          const name = tx.product_name?.toUpperCase() || '';
          return (name.includes('A001') || name.includes('A009') || 
                  name.includes('A003') || name.includes('A004')) &&
                 !name.includes('P2') && !name.includes('A005');
        });
        
        // Identificar transações P2
        const p2Transactions = txGroup.filter(tx => {
          const name = tx.product_name?.toUpperCase() || '';
          return name.includes('P2') || name.includes('A005');
        });
        
        // Calcular valores consolidados
        const totalNet = txGroup.reduce((sum, tx) => sum + (tx.net_value || 0), 0);
        
        // Calcular bruto consolidado:
        // - Produto principal: usar product_price
        // - P2s: somar product_price de cada um
        // - Se só tem "Parceria" genérico: usar product_price como bruto
        let consolidatedGross = 0;
        
        if (mainProduct) {
          // Produto principal identificado - usar preço de referência enriquecido ou calculado
          consolidatedGross = mainProduct.enriched_reference_price ?? 
                              getProductReferencePrice(mainProduct.product_name) ?? 
                              mainProduct.product_price ?? 0;
        } else {
          // Sem produto principal - verificar se primeira transação tem preço enriquecido
          const firstTx = txGroup[0];
          if (firstTx.enriched_reference_price !== undefined) {
            consolidatedGross = firstTx.enriched_reference_price;
          } else if (firstTx.product_name?.toLowerCase().trim() === 'parceria') {
            // Transação genérica sem enriquecimento - usar product_price real
            consolidatedGross = firstTx.product_price || 0;
          } else {
            // Somar todos os product_price (entrada parcelada)
            consolidatedGross = txGroup
              .filter(tx => !p2Transactions.includes(tx))
              .reduce((sum, tx) => sum + (tx.product_price || 0), 0);
          }
        }
        
        // P2s NÃO somam no bruto - apenas no líquido (já incluso em totalNet)
        const p2Total = p2Transactions.reduce((sum, tx) => sum + (tx.product_price || 0), 0);
        // consolidatedGross permanece apenas com valor do produto principal
        
        // Usar dados do produto principal ou primeiro da lista
        const baseTransaction = mainProduct || txGroup[0];
        
        // Determinar o nome do produto a exibir
        let displayProductName = baseTransaction.product_name;
        if (displayProductName?.toLowerCase().trim() === 'parceria' && txGroup.length === 1) {
          // Manter "Parceria" mas o bruto será o product_price real
        }
        
        consolidatedVendas.push({
          ...baseTransaction,
          // Substituir valores agregados
          net_value: totalNet,
          consolidated_gross: consolidatedGross,
          // Marcar se tem P2 incluído
          has_p2: p2Transactions.length > 0,
          p2_count: p2Transactions.length,
          p2_total: p2Total,
          // Lista de todas transações do cliente (para detalhes)
          related_transactions: txGroup.length > 1 ? txGroup : undefined,
        });
      });

      return consolidatedVendas;
    },
    refetchInterval: 60000, // 1 minuto
  });
}
