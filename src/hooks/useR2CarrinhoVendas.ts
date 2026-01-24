import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { endOfDay } from 'date-fns';

// Helper para normalização consistente (apenas dígitos, últimos 11)
const normalizeForMatch = (phone: string | null): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, '').slice(-11);
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
}

export function useR2CarrinhoVendas(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

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

      let linkedAttendeesMap = new Map<string, { name: string | null; closerName: string | null; closerColor: string | null }>();

      if (linkedAttendeeIds.length > 0) {
        const { data: linkedAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id,
            attendee_name,
            meeting_slot:meeting_slots!inner (
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
        let attendeeData: { name: string | null; closerName: string | null; closerColor: string | null } | undefined;

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

        // Match manual (linked_attendee_id)
        if (!matched && tx.linked_attendee_id) {
          const linkedData = linkedAttendeesMap.get(tx.linked_attendee_id);
          if (linkedData) {
            matched = true;
            isManualLink = true;
            attendeeData = linkedData;
          }
        }

        if (matched) {
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
          });
        }
      });

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
          // Produto principal identificado - usar seu preço de referência
          consolidatedGross = mainProduct.product_price || 0;
        } else {
          // Sem produto principal - somar todos os product_price (entrada parcelada)
          consolidatedGross = txGroup
            .filter(tx => !p2Transactions.includes(tx))
            .reduce((sum, tx) => sum + (tx.product_price || 0), 0);
        }
        
        // Adicionar P2s ao bruto
        const p2Total = p2Transactions.reduce((sum, tx) => sum + (tx.product_price || 0), 0);
        consolidatedGross += p2Total;
        
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
    refetchInterval: 30000,
  });
}
