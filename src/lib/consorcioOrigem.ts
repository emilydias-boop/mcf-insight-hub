import { ORIGEM_OPTIONS } from '@/types/consorcio';

export interface OrigemCatalogItem {
  id: string;
  name: string;
  label: string;
}

/**
 * Rótulo único da origem da cota.
 *
 * Regra: catálogo (`consorcio_origem_options.name`) → lista estática legada
 * (`ORIGEM_OPTIONS.value`) → valor cru. Nunca devolve `-`: esconder o valor cru
 * escondia UUIDs gravados por engano pelo funil.
 */
export function resolveOrigemLabel(
  origem: string | null | undefined,
  origemOptions: OrigemCatalogItem[] = [],
): string {
  const raw = (origem || '').trim();
  if (!raw) return '';
  const doCatalogo = origemOptions.find((o) => o.name === raw || o.id === raw);
  if (doCatalogo) return doCatalogo.label || doCatalogo.name;
  const estatica = ORIGEM_OPTIONS.find((o) => o.value === raw);
  if (estatica) return estatica.label;
  return raw;
}
