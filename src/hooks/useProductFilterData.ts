import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface ProductFilterRule {
  product: string;
  mode: 'has' | 'not_has';
}

export type ProductOperator = 'and' | 'or';

/**
 * Normaliza product_name para um label amigável.
 * Agrupa variantes óbvias (ex: "Efeito Alavanca 2026 - Parcelado" → "Efeito Alavanca 2026").
 */
function normalizeProductLabel(productName: string): string {
  const trimmed = productName.trim();

  // Efeito Alavanca variants
  const efeitoMatch = trimmed.match(/Efeito\s+Alavanca\s+\d{4}/i);
  if (efeitoMatch) return efeitoMatch[0];

  // Anticrise variants
  if (/Anticrise\s+B[aá]sico/i.test(trimmed)) return 'Anticrise Básico';
  if (/Anticrise\s+Completo/i.test(trimmed)) return 'Anticrise Completo';
  if (/Anticrise/i.test(trimmed)) return 'Anticrise';

  // Construir para Alugar
  if (/Construir\s+para\s+Alugar/i.test(trimmed)) return 'Construir para Alugar';

  // A0XX codes
  const codeMatch = trimmed.match(/^(A\d{3})/i);
  if (codeMatch) return codeMatch[1].toUpperCase();

  // Fallback: return as-is (trimmed)
  return trimmed;
}

/**
 * Hook that fetches purchased products for a set of emails from hubla_transactions.
 * Returns a Map<email, Set<productLabel>> and the list of all available product labels.
 */
export const useProductFilterData = (emails: string[]) => {
  // Deduplicate and lowercase emails
  const uniqueEmails = useMemo(() => {
    const set = new Set(emails.map(e => e.toLowerCase().trim()).filter(Boolean));
    return Array.from(set);
  }, [emails]);

  const query = useQuery({
    queryKey: ['product-filter-data', uniqueEmails.length > 0 ? uniqueEmails.sort().join(',') : '__empty__'],
    queryFn: async () => {
      if (uniqueEmails.length === 0) return { productMap: new Map<string, Set<string>>(), availableProducts: [] as string[] };

      // Fetch in chunks to avoid URL limits
      const CHUNK_SIZE = 200;
      const allRows: { customer_email: string; product_name: string }[] = [];

      for (let i = 0; i < uniqueEmails.length; i += CHUNK_SIZE) {
        const chunk = uniqueEmails.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('hubla_transactions')
          .select('customer_email, product_name')
          .in('customer_email', chunk)
          .eq('sale_status', 'completed')
          .not('product_name', 'is', null);

        if (error) {
          console.error('Error fetching product filter data:', error);
          continue;
        }
        if (data) allRows.push(...(data as any[]));
      }

      // Build email → Set<label> map
      const productMap = new Map<string, Set<string>>();
      const allLabels = new Set<string>();

      for (const row of allRows) {
        const email = row.customer_email?.toLowerCase().trim();
        const label = normalizeProductLabel(row.product_name);
        if (!email || !label) continue;

        allLabels.add(label);
        if (!productMap.has(email)) {
          productMap.set(email, new Set());
        }
        productMap.get(email)!.add(label);
      }

      return {
        productMap,
        availableProducts: Array.from(allLabels).sort(),
      };
    },
    enabled: uniqueEmails.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    productMap: query.data?.productMap ?? new Map<string, Set<string>>(),
    availableProducts: query.data?.availableProducts ?? [],
    isLoading: query.isLoading,
  };
};
