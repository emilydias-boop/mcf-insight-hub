import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { endOfDay } from 'date-fns';

export interface UnlinkedTransaction {
  id: string;
  hubla_id: string;
  product_name: string | null;
  product_price: number | null;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string;
  source: string | null;
}

export function useUnlinkedTransactions(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  return useQuery({
    queryKey: ['unlinked-transactions', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      // Buscar todas transações de parceria da semana (matching por email/telefone filtra relevância)
      const { data: transactions, error: txError } = await supabase
        .from('hubla_transactions')
        .select('*')
        .eq('product_category', 'parceria')
        .gte('sale_date', weekStart.toISOString())
        .lte('sale_date', endOfDay(weekEnd).toISOString())
        .is('linked_attendee_id', null)
        .order('sale_date', { ascending: false });

      if (txError) throw txError;
      if (!transactions) return [];

      // Buscar emails e telefones dos leads aprovados da semana
      const { data: approvedAttendees, error: attendeesError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_phone,
          deal:crm_deals (
            contact:crm_contacts (
              email,
              phone
            )
          )
        `)
        .eq('r2_status_id', '24d9a326-378b-4191-a4b3-d0ec8b9d23eb');

      if (attendeesError) throw attendeesError;

      // Coletar emails e telefones dos aprovados
      const approvedEmails = new Set<string>();
      const approvedPhones = new Set<string>();

      const approvedNames = new Set<string>();

      approvedAttendees?.forEach((att: any) => {
        const email = att.deal?.contact?.email?.toLowerCase();
        const phone = att.attendee_phone || att.deal?.contact?.phone;
        
        if (email) approvedEmails.add(email);
        if (phone) {
          const digits = phone.replace(/\D/g, '');
          const normalized = digits.length >= 9 ? digits.slice(-9) : null;
          if (normalized) approvedPhones.add(normalized);
        }
        // Nome normalizado como fallback
        const name = att.deal?.contact?.name?.toUpperCase().trim();
        if (name) approvedNames.add(name);
      });

      // Filtrar transações que NÃO têm match automático
      const unlinkedTransactions: UnlinkedTransaction[] = [];

      transactions.forEach((tx: any) => {
        const txEmail = tx.customer_email?.toLowerCase();
        const txPhoneDigits = tx.customer_phone?.replace(/\D/g, '') || '';
        const txPhone = txPhoneDigits.length >= 9 ? txPhoneDigits.slice(-9) : null;
        const txName = tx.customer_name?.toUpperCase().trim();

        const hasEmailMatch = txEmail && approvedEmails.has(txEmail);
        const hasPhoneMatch = txPhone && approvedPhones.has(txPhone);
        const hasNameMatch = txName && approvedNames.has(txName);

        // Se não tem match automático, adiciona na lista
        if (!hasEmailMatch && !hasPhoneMatch && !hasNameMatch) {
          unlinkedTransactions.push({
            id: tx.id,
            hubla_id: tx.hubla_id,
            product_name: tx.product_name,
            product_price: tx.product_price,
            net_value: tx.net_value,
            customer_name: tx.customer_name,
            customer_email: tx.customer_email,
            customer_phone: tx.customer_phone,
            sale_date: tx.sale_date,
            source: tx.source,
          });
        }
      });

      return unlinkedTransactions;
    },
  });
}
