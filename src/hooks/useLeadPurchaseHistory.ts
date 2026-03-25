import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^a\d{3}\s*-\s*/, '')
    .trim();
}

function deduplicatePurchases(items: PurchaseHistoryItem[]): PurchaseHistoryItem[] {
  const dayKey = (d: string) => d.slice(0, 10);
  const prioritySources = ['hubla', 'kiwify'];

  // Group by day + normalized product name
  const groups = new Map<string, PurchaseHistoryItem[]>();
  for (const item of items) {
    const key = `${dayKey(item.sale_date)}|${normalizeProductName(item.product_name)}`;
    const arr = groups.get(key) || [];
    arr.push(item);
    groups.set(key, arr);
  }

  const result: PurchaseHistoryItem[] = [];
  for (const group of groups.values()) {
    const priority = group.filter(i => prioritySources.includes(i.source || ''));
    const others = group.filter(i => !prioritySources.includes(i.source || ''));

    if (priority.length > 0) {
      // Keep one per source from priority, drop make duplicates
      const seen = new Set<string>();
      for (const item of priority) {
        const k = `${item.source}|${item.product_name}`;
        if (!seen.has(k)) { seen.add(k); result.push(item); }
      }
    } else {
      // No priority source, keep one per source
      const seen = new Set<string>();
      for (const item of others) {
        const k = `${item.source}|${item.product_name}`;
        if (!seen.has(k)) { seen.add(k); result.push(item); }
      }
    }
  }

  return result.sort((a, b) => b.sale_date.localeCompare(a.sale_date));
}

export interface PurchaseHistoryItem {
  id: string;
  product_name: string;
  product_price: number;
  sale_date: string;
  sale_status: string;
  source: string | null;
}

export function useLeadPurchaseHistory(email: string | null | undefined, phone?: string | null) {
  // Extract 9-digit phone suffix for matching
  const phoneSuffix = phone ? phone.replace(/\D/g, '').slice(-9) : '';
  const hasPhone = phoneSuffix.length >= 8;
  const hasEmail = !!email;

  return useQuery({
    queryKey: ['lead-purchase-history', email, phoneSuffix],
    queryFn: async (): Promise<PurchaseHistoryItem[]> => {
      if (!hasEmail && !hasPhone) return [];

      let query = supabase
        .from('hubla_transactions')
        .select('id, product_name, product_price, sale_date, sale_status, source')
        .in('source', ['hubla', 'kiwify', 'manual', 'make']);

      if (hasEmail && hasPhone) {
        // Search by email OR phone suffix
        query = query.or(`customer_email.eq.${email},customer_phone.ilike.%${phoneSuffix}`);
      } else if (hasEmail) {
        query = query.eq('customer_email', email);
      } else {
        // Only phone
        query = query.ilike('customer_phone', `%${phoneSuffix}`);
      }

      const { data, error } = await query
        .order('sale_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return deduplicatePurchases((data || []) as PurchaseHistoryItem[]);
    },
    enabled: hasEmail || hasPhone,
  });
}
