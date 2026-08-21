/**
 * Quais campos cadastrais faltam num cadastro pendente de consórcio.
 *
 * A regra é a MESMA usada para acender o selo "cadastro incompleto"
 * (`isChecklistIncompleto` em `useConsorcioPendingRegistrations`): aqui só
 * traduzimos para a lista de rótulos, para a tela dizer QUAL campo falta em vez
 * de apenas "incompleto". Alterar esta lista muda o que a tela cobra e o selo —
 * não afeta métrica, meta nem funil.
 */
const CAMPOS_PF: Array<{ key: string; label: string }> = [
  { key: 'nome_completo', label: 'Nome completo' },
  { key: 'cpf', label: 'CPF' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'endereco_completo', label: 'Endereço' },
  { key: 'renda', label: 'Renda' },
];

const CAMPOS_PJ: Array<{ key: string; label: string }> = [
  { key: 'razao_social', label: 'Razão social' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'telefone_comercial', label: 'Telefone comercial' },
  { key: 'email_comercial', label: 'E-mail comercial' },
  { key: 'endereco_comercial', label: 'Endereço comercial' },
  { key: 'faturamento_mensal', label: 'Faturamento mensal' },
];

const preenchido = (v: unknown) =>
  v !== undefined && v !== null && String(v).trim() !== '' && Number(v) !== 0;

/** Rótulos dos campos obrigatórios ainda vazios. Vazio = cadastro completo. */
export function camposCadastroFaltantes(
  reg: Record<string, unknown> & { tipo_pessoa?: string | null },
): string[] {
  const campos = reg?.tipo_pessoa === 'pj' ? CAMPOS_PJ : CAMPOS_PF;
  const faltantes = campos.filter(c => !preenchido(reg?.[c.key])).map(c => c.label);
  // Sem valor de parcela o Termo de Adesão não pode ser gerado.
  if (!preenchido(reg?.parcela_1a_12a)) faltantes.push('Valor da parcela (1ª à 12ª)');
  // Sem categoria e origem a cota não abre na Embracon nem entra certa no canal.
  if (!preenchido(reg?.categoria)) faltantes.push('Categoria');
  if (!preenchido(reg?.origem)) faltantes.push('Origem');
  return faltantes;
}


/** Texto curto para selo/tooltip: "faltam 3: CPF, E-mail, Renda". */
export function resumoCamposFaltantes(faltantes: string[]): string {
  if (faltantes.length === 0) return 'Cadastro completo';
  return `Faltam ${faltantes.length}: ${faltantes.join(', ')}`;
}
