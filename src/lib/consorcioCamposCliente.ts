/**
 * Lista FECHADA dos campos de `consorcio_pending_registrations` que descrevem a
 * PESSOA, e não a carta. Só estes podem ser propagados dos demais cadastros do
 * mesmo cliente na mesma venda.
 *
 * A lista foi extraída do que o formulário de cliente já grava
 * (`montarPatchCadastro` em `OpenCotaModal.tsx`, blocos "// cliente" e "// PJ"),
 * não por dedução. Qualquer campo de carta (crédito, plano, parcelas, grupo,
 * cota, vínculo de cota, status, datas do fluxo, comissão) fica FORA de
 * propósito: propagar isso transformaria N cartas diferentes em N cópias da
 * mesma e destruiria a venda.
 */
export const CAMPOS_CLIENTE_PROPAGAVEIS = [
  // PF / identificação e contato
  'nome_completo',
  'cpf',
  'rg',
  'cpf_conjuge',
  'profissao',
  'telefone',
  'email',
  'endereco_completo',
  'endereco_cep',
  'renda',
  'patrimonio',
  'pix',
  // PJ
  'razao_social',
  'cnpj',
  'natureza_juridica',
  'inscricao_estadual',
  'data_fundacao',
  'telefone_comercial',
  'email_comercial',
  'endereco_comercial',
  'endereco_comercial_cep',
  'num_funcionarios',
  'faturamento_mensal',
] as const;

const PERMITIDOS = new Set<string>(CAMPOS_CLIENTE_PROPAGAVEIS as readonly string[]);

/** Mantém do patch apenas os campos da pessoa. Tudo o mais é descartado. */
export function filtrarCamposCliente(
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!patch) return {};
  return Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => PERMITIDOS.has(k) && v !== undefined),
  );
}

/** Só dígitos — chave de agrupamento por documento. */
function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function nomeNormalizado(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Chave da PESSOA: CPF (PF) ou CNPJ (PJ). Sem documento, cai no nome
 * normalizado — e, sem nome, no próprio id (nunca agrupa dois desconhecidos).
 */
export function chavePessoa(r: {
  id: string;
  tipo_pessoa?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  nome_completo?: string | null;
  razao_social?: string | null;
}): string {
  const doc = r.tipo_pessoa === 'pj' ? soDigitos(r.cnpj) : soDigitos(r.cpf);
  if (doc) return `doc:${doc}`;
  const nome = nomeNormalizado(r.tipo_pessoa === 'pj' ? r.razao_social : r.nome_completo);
  if (nome) return `nome:${nome}`;
  return `id:${r.id}`;
}

export interface GrupoPessoa<T> {
  chave: string;
  cadastros: T[];
}

/** Agrupa mantendo a ordem de entrada (que já é a ordem das cartas). */
export function agruparPorPessoa<
  T extends Parameters<typeof chavePessoa>[0],
>(cadastros: T[]): Array<GrupoPessoa<T>> {
  const mapa = new Map<string, GrupoPessoa<T>>();
  for (const r of cadastros) {
    const chave = chavePessoa(r);
    const g = mapa.get(chave);
    if (g) g.cadastros.push(r);
    else mapa.set(chave, { chave, cadastros: [r] });
  }
  return Array.from(mapa.values());
}
