import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PartnerProductInfo {
  isPartner: boolean;
  productLabel: string | null;
  productName: string | null;
}

interface AttendeeForCheck {
  id: string;
  email: string | null;
}

export type ProductGroup = 'incorporador' | 'anticrise' | 'outros';

// Map product_name patterns to display labels and groups
const PRODUCT_MAPPINGS: { pattern: RegExp; label: string; group: ProductGroup }[] = [
  { pattern: /A001/i, label: 'A001', group: 'incorporador' },
  { pattern: /A009/i, label: 'A009', group: 'incorporador' },
  { pattern: /A002/i, label: 'A002', group: 'incorporador' },
  { pattern: /A010/i, label: 'A010', group: 'outros' },
  { pattern: /Anticrise Completo|A003/i, label: 'Anticrise', group: 'anticrise' },
  { pattern: /Anticrise B[aá]sico|A004/i, label: 'Anticrise Básico', group: 'anticrise' },
];

export const PRODUCT_GROUPS: Record<ProductGroup, { label: string; icon: string; products: string[] }> = {
  incorporador: { label: 'Incorporador', icon: '🏗️', products: ['A001', 'A009', 'A002'] },
  anticrise: { label: 'Anticrise', icon: '📉', products: ['Anticrise', 'Anticrise Básico'] },
  outros: { label: 'Outros', icon: '📦', products: ['A010'] },
};

// Products to ignore (treated as new lead, not partner)
const IGNORED_PRODUCTS = [
  /Construir para Alugar/i,
  /Contrato/i,
  /P2/i,
  /Suplemento/i,
];

interface ClassifiedProduct {
  label: string;
  group: ProductGroup;
}

function classifyProduct(productName: string): ClassifiedProduct | null {
  // Check if it should be ignored
  if (IGNORED_PRODUCTS.some(p => p.test(productName))) return null;
  
  // Find matching product label
  for (const mapping of PRODUCT_MAPPINGS) {
    if (mapping.pattern.test(productName)) return { label: mapping.label, group: mapping.group };
  }
  
  // Unknown product but not ignored - still a partner
  return { label: productName, group: 'outros' };
}

/**
 * Batch hook to detect partner products for leads in the Consórcio BU.
 * Returns which main product each lead purchased (A001, A009, Anticrise, etc).
 */
/**
 * Hook to fetch ALL distinct partner products from the database.
 * Returns classified labels for use in filter dropdowns.
 */
export const useAllPartnerProducts = () => {
  return useQuery({
    queryKey: ['all-partner-products'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('product_name')
        .eq('sale_status', 'completed')
        .not('product_name', 'is', null);

      if (error) {
        console.error('Error fetching all partner products:', error);
        return [];
      }

      // Classify and deduplicate
      const labels = new Set<string>();
      for (const tx of data || []) {
        if (!tx.product_name) continue;
        const classified = classifyProduct(tx.product_name);
        if (classified) labels.add(classified.label);
      }

      return Array.from(labels).sort();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const usePartnerProductDetectionBatch = (attendees: AttendeeForCheck[]) => {
  return useQuery({
    queryKey: ['partner-product-detection', attendees.map(a => `${a.id}:${a.email}`).join(',')],
    queryFn: async (): Promise<Record<string, PartnerProductInfo>> => {
      if (!attendees.length) return {};

      const emails = [...new Set(
        attendees
          .map(a => a.email?.toLowerCase().trim())
          .filter((email): email is string => Boolean(email))
      )];

      if (!emails.length) return {};

      // Fetch all completed transactions for these emails
      const { data: transactions, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email, product_name')
        .in('customer_email', emails)
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions for partner detection:', error);
        return {};
      }

      // Build email -> best product map (label + full name)
      const emailToProduct = new Map<string, { label: string; fullName: string }>();
      for (const tx of transactions || []) {
        const email = tx.customer_email?.toLowerCase().trim();
        if (!email || !tx.product_name) continue;
        if (emailToProduct.has(email)) continue; // keep first (most recent)
        
        const classified = classifyProduct(tx.product_name);
        if (classified) {
          emailToProduct.set(email, { label: classified.label, fullName: tx.product_name });
        }
      }

      // Map back to attendee IDs
      const result: Record<string, PartnerProductInfo> = {};
      for (const att of attendees) {
        const email = att.email?.toLowerCase().trim();
        if (!email) continue;
        
        const product = emailToProduct.get(email);
        if (product) {
          result[att.id] = {
            isPartner: true,
            productLabel: product.label,
            productName: product.fullName,
          };
        }
      }

      return result;
    },
    enabled: attendees.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });
};
