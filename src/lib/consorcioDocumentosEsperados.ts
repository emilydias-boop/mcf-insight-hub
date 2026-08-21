import { TIPO_DOCUMENTO_OPTIONS } from '@/types/consorcio';

/**
 * Checklist de documentos esperados para cadastrar a cota na Embracon.
 *
 * IMPORTANTE: o banco NÃO guarda uma regra de documentos obrigatórios — o selo
 * "documento faltando" da etapa 4 só sabe dizer se o cadastro tem zero anexos.
 * Este é o checklist de convenção usado para dizer QUAL documento falta; alterar
 * aqui muda o que a tela cobra, e nada mais (não afeta métrica nem funil).
 */
export interface DocumentoEsperado {
  /** Tipos que satisfazem o item (ex.: identidade aceita CNH ou RG). */
  tipos: string[];
  label: string;
}

const ESPERADOS_PF: DocumentoEsperado[] = [
  { tipos: ['cnh', 'rg'], label: 'Documento de identidade (CNH ou RG)' },
  { tipos: ['comprovante_residencia'], label: 'Comprovante de residência' },
];

const ESPERADOS_PJ: DocumentoEsperado[] = [
  { tipos: ['contrato_social'], label: 'Contrato Social' },
  { tipos: ['cartao_cnpj'], label: 'Cartão CNPJ' },
  { tipos: ['cnh', 'rg'], label: 'Identidade do representante (CNH ou RG)' },
  { tipos: ['comprovante_residencia'], label: 'Comprovante de residência' },
];

export function documentosEsperados(tipoPessoa: 'pf' | 'pj'): DocumentoEsperado[] {
  return tipoPessoa === 'pj' ? ESPERADOS_PJ : ESPERADOS_PF;
}

/** Itens do checklist ainda sem nenhum anexo correspondente. */
export function documentosFaltantes(
  tipoPessoa: 'pf' | 'pj',
  anexados: Array<{ tipo?: string | null }>,
): DocumentoEsperado[] {
  const presentes = new Set(anexados.map((d) => String(d.tipo || '')));
  return documentosEsperados(tipoPessoa).filter((e) => !e.tipos.some((t) => presentes.has(t)));
}

export function tipoDocumentoLabel(tipo: string): string {
  return TIPO_DOCUMENTO_OPTIONS.find((o) => o.value === tipo)?.label || tipo;
}
