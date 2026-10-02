// Qualificação da BU Crédito Imobiliário — perguntas do PDF "Qualificação - Crédito" (01/10/2026).
// As chaves/opções abaixo são lidas por public.classify_credito_icp() no banco — manter os textos idênticos.
// A chave 'modalidade' é o marcador de que as respostas são deste formulário (QualificationHistorySection).
import { MIN_ANSWER_LENGTH } from './QualificationQuestions';

export type CreditoModalidade = 'Construção' | 'Home Equity' | 'Imóvel Pronto';
export const CREDITO_MODALIDADES: CreditoModalidade[] = ['Construção', 'Home Equity', 'Imóvel Pronto'];

export type CreditoAnswers = Record<string, string>;

export interface CreditoQuestion {
  key: string;
  label: string;
  /** choice = botões; money = R$; short = linha curta (nome, CPF, cidade); text = texto livre longo */
  type: 'choice' | 'money' | 'short' | 'text';
  options?: string[];
  placeholder?: string;
  /** Só aparece para estas modalidades; ausente = sempre. */
  showWhen?: CreditoModalidade[];
  /** Condição extra sobre outras respostas (ex.: saldo devedor só se não quitado). */
  showIf?: (a: CreditoAnswers) => boolean;
  /** Pergunta informativa (não bloqueia o salvar). */
  optional?: boolean;
  /** money: aceita 0 (ex.: saldo devedor zerado, renda informal inexistente). */
  allowZero?: boolean;
  /** Título de seção exibido antes desta pergunta. */
  section?: string;
  help?: string;
}

const FONTES_RENDA = ['CLT', 'Empresário', 'Servidor', 'Aposentado', 'Autônomo'];
const C: CreditoModalidade[] = ['Construção'];
const HE: CreditoModalidade[] = ['Home Equity'];
const IP: CreditoModalidade[] = ['Imóvel Pronto'];

export const CREDITO_QUALIFICATION_QUESTIONS: CreditoQuestion[] = [
  { key: 'modalidade', label: 'O que o lead quer fazer?', type: 'choice', options: CREDITO_MODALIDADES },

  // ───────── CONSTRUÇÃO ─────────
  { key: 'finalidade', label: 'Construção para venda ou moradia?', type: 'choice', showWhen: C, section: 'Obra',
    options: ['Venda', 'Moradia'] },
  { key: 'projeto_aprovado', label: 'Obra já possui projeto aprovado na prefeitura?', type: 'choice', showWhen: C,
    options: ['Sim', 'Não', 'Já foi dado entrada'] },
  { key: 'rgi_nome', label: 'Possui RGI do terreno em seu nome?', type: 'choice', showWhen: C,
    options: ['Sim, em meu nome', 'Não / nome de terceiros', 'Nome de PJ'] },
  { key: 'valor_terreno', label: 'Valor do terreno', type: 'money', showWhen: C, placeholder: 'Ex: 200000' },
  { key: 'saldo_devedor_terreno', label: 'Saldo devedor do terreno', type: 'money', showWhen: C, allowZero: true,
    placeholder: '0 se quitado', help: 'ICP exige pelo menos 50% do terreno pago.' },
  { key: 'valor_obra', label: 'Valor total de obra (estimado)', type: 'money', showWhen: C, placeholder: 'Ex: 450000' },
  { key: 'valor_imovel_pronto', label: 'Valor do imóvel pronto para compra e venda (estimado)', type: 'money', showWhen: C, placeholder: 'Ex: 900000' },
  { key: 'gasto_obra', label: 'Quanto já gastou na obra', type: 'money', showWhen: C, allowZero: true, placeholder: '0 se ainda não começou' },
  { key: 'recursos_proprios', label: 'Quanto ainda possui em recursos próprios (fora o que já foi gasto na obra)?', type: 'money', showWhen: C, allowZero: true },
  { key: 'fonte_renda', label: 'Qual a fonte de renda?', type: 'choice', showWhen: C, section: 'Renda', options: FONTES_RENDA },
  { key: 'renda_formal', label: 'Renda mensal formal', type: 'money', showWhen: C, allowZero: true, placeholder: 'Ex: 15000' },
  { key: 'renda_informal', label: 'Renda mensal informal', type: 'money', showWhen: C, allowZero: true, placeholder: '0 se não tiver',
    help: 'ICP de Construção: renda formal + informal a partir de R$ 20.000.' },
  { key: 'cidade_uf', label: 'Cidade e Estado', type: 'short', showWhen: C, section: 'Localização', placeholder: 'Ex: Sorocaba/SP' },
  { key: 'tipo_terreno', label: 'Terreno de rua ou condomínio?', type: 'choice', showWhen: C, options: ['Rua', 'Condomínio'] },

  // ───────── HOME EQUITY ─────────
  { key: 'motivacao', label: 'Motivação do crédito (especifique)', type: 'text', showWhen: HE, section: 'Crédito',
    placeholder: 'Ex: quitar dívidas do cartão e capital de giro para a empresa...' },
  { key: 'valor_credito', label: 'Valor do crédito pretendido', type: 'money', showWhen: HE, placeholder: 'Ex: 300000' },
  { key: 'tipo_imovel', label: 'Tipo de imóvel', type: 'choice', showWhen: HE, section: 'Imóvel em garantia',
    options: ['Casa', 'Apartamento', 'Sala/Loja comercial', 'Galpão', 'Outro'] },
  { key: 'ocupacao', label: 'Ocupado, desocupado ou alugado?', type: 'choice', showWhen: HE, options: ['Ocupado', 'Desocupado', 'Alugado'] },
  { key: 'valor_imovel', label: 'Valor do imóvel', type: 'money', showWhen: HE, placeholder: 'Ex: 800000' },
  { key: 'iptu_em_dia', label: 'IPTU em dia?', type: 'choice', showWhen: HE, options: ['Sim', 'Não'] },
  { key: 'quitado', label: 'Imóvel está quitado?', type: 'choice', showWhen: HE, options: ['Sim', 'Não'] },
  { key: 'saldo_devedor', label: 'Qual o saldo devedor do imóvel?', type: 'money', showWhen: HE,
    showIf: (a) => a.quitado === 'Não', placeholder: 'Ex: 120000' },
  { key: 'averbacao', label: 'RGI possui averbação da construção?', type: 'choice', showWhen: HE, options: ['Sim', 'Não'],
    help: 'ICP de Home Equity: averbação + imóvel em nome do cliente + renda acima de R$ 6.000.' },
  { key: 'titularidade', label: 'Está em nome de PF ou PJ?', type: 'choice', showWhen: HE, options: ['PF', 'PJ'] },
  { key: 'em_nome_cliente', label: 'Imóvel está em nome do cliente?', type: 'choice', showWhen: HE, options: ['Sim', 'Não'] },
  { key: 'cidade_uf', label: 'Cidade e Estado', type: 'short', showWhen: HE, placeholder: 'Ex: Campinas/SP' },
  { key: 'fonte_renda', label: 'Qual a fonte de renda?', type: 'choice', showWhen: HE, section: 'Renda', options: FONTES_RENDA },
  { key: 'renda_formal', label: 'Valor de renda formal', type: 'money', showWhen: HE, allowZero: true, placeholder: 'Ex: 8000' },
  { key: 'renda_informal', label: 'Valor de renda informal', type: 'money', showWhen: HE, allowZero: true, placeholder: '0 se não tiver' },

  // ───────── IMÓVEL PRONTO ─────────
  { key: 'nome_completo', label: 'Nome completo', type: 'short', showWhen: IP, section: 'Dados do proponente' },
  { key: 'cpf', label: 'CPF', type: 'short', showWhen: IP, placeholder: '000.000.000-00', help: 'CPF, RG, nascimento e estado civil ficam guardados em área restrita ao time do Crédito (LGPD).' },
  { key: 'rg', label: 'RG', type: 'short', showWhen: IP },
  { key: 'data_nascimento', label: 'Data de nascimento', type: 'short', showWhen: IP, placeholder: 'dd/mm/aaaa' },
  { key: 'estado_civil', label: 'Estado civil e regime de bens', type: 'short', showWhen: IP, placeholder: 'Ex: Casado, comunhão parcial' },
  { key: 'residencia_atual', label: 'Imóvel de residência atual', type: 'choice', showWhen: IP, options: ['Alugado', 'Próprio', 'Dos pais'] },
  { key: 'escolaridade', label: 'Nível de escolaridade', type: 'choice', showWhen: IP,
    options: ['Fundamental', 'Médio', 'Superior', 'Pós-graduação'] },
  { key: 'profissao', label: 'Profissão', type: 'short', showWhen: IP },
  { key: 'fonte_renda', label: 'Atividade profissional', type: 'choice', showWhen: IP, options: FONTES_RENDA },
  { key: 'cnpj', label: 'CNPJ da empresa', type: 'short', showWhen: IP, showIf: (a) => a.fonte_renda === 'Empresário',
    placeholder: '00.000.000/0000-00' },
  { key: 'renda_mensal', label: 'Renda mensal', type: 'money', showWhen: IP, placeholder: 'Ex: 12000' },
  { key: 'email', label: 'E-mail', type: 'short', showWhen: IP },
  { key: 'celular', label: 'Celular', type: 'short', showWhen: IP, placeholder: '(11) 90000-0000' },
  { key: 'endereco_imovel', label: 'Endereço completo do imóvel que deseja adquirir', type: 'text', showWhen: IP, section: 'Imóvel desejado' },
  { key: 'tipo_imovel', label: 'Tipo do imóvel', type: 'choice', showWhen: IP, options: ['Casa', 'Apartamento'] },
  { key: 'condominio_ou_rua', label: 'Condomínio ou rua?', type: 'choice', showWhen: IP, options: ['Condomínio', 'Rua'] },
  { key: 'valor_imovel', label: 'Valor do imóvel', type: 'money', showWhen: IP, placeholder: 'Ex: 450000',
    help: 'Documentos necessários: CNH/RG (proponente e cônjuge) e comprovante de residência.' },

  // ───────── TODAS ─────────
  { key: 'observacoes', label: 'Observações do SDR', type: 'text', optional: true, section: 'Observações',
    placeholder: 'Ex: quer começar a obra em 6 meses, já conversou com a Caixa...' },
];

export function creditoVisibleQuestions(answers: CreditoAnswers): CreditoQuestion[] {
  const mod = (answers.modalidade || '') as CreditoModalidade;
  return CREDITO_QUALIFICATION_QUESTIONS.filter(q =>
    (!q.showWhen || (mod && q.showWhen.includes(mod))) && (!q.showIf || q.showIf(answers))
  );
}

/** Remove respostas de perguntas que deixaram de valer (troca de modalidade ou condição). */
export function pruneCreditoAnswers(answers: CreditoAnswers): CreditoAnswers {
  const keys = new Set(creditoVisibleQuestions(answers).map(q => q.key));
  const next: CreditoAnswers = {};
  for (const [k, v] of Object.entries(answers)) if (keys.has(k)) next[k] = v;
  return next;
}

export function parseMoney(v: string | undefined): number | null {
  if (v == null || String(v).trim() === '') return null;
  const digits = String(v).replace(/[^\d,\.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(digits);
  return isNaN(n) ? null : n;
}

export function creditoAnswerOk(q: CreditoQuestion, value: string): boolean {
  const v = (value || '').trim();
  if (q.type === 'choice') return v.length > 0;
  if (q.type === 'money') {
    const n = parseMoney(v);
    return n !== null && (q.allowZero ? n >= 0 : n > 0);
  }
  if (q.type === 'short') return v.length >= 2;
  return v.length >= MIN_ANSWER_LENGTH;
}

/** Só as perguntas visíveis e não opcionais bloqueiam. Renda formal + informal precisa ser > 0. */
export function validateCreditoAnswers(answers: CreditoAnswers): { valid: boolean; missing: string[] } {
  const missing = creditoVisibleQuestions(answers)
    .filter(q => !q.optional && !creditoAnswerOk(q, answers[q.key] || ''))
    .map(q => q.key);
  const mod = answers.modalidade;
  if ((mod === 'Construção' || mod === 'Home Equity') && creditoRendaTotal(answers) <= 0) {
    if (!missing.includes('renda_formal')) missing.push('renda_formal');
  }
  return { valid: missing.length === 0, missing };
}

/** Renda considerada no ICP: formal + informal (decisão 01/10/2026). Espelho de public.credito_renda_total. */
export function creditoRendaTotal(answers: CreditoAnswers): number {
  if ('renda_formal' in answers || 'renda_informal' in answers) {
    return (parseMoney(answers.renda_formal) ?? 0) + (parseMoney(answers.renda_informal) ?? 0);
  }
  return parseMoney(answers.renda_mensal ?? answers.renda) ?? 0;
}

/** Espelho de public.classify_credito_icp() só para pré-visualizar no formulário. O banco é a fonte da verdade. */
export function previewCreditoIcp(answers: CreditoAnswers): 'ICP' | 'Parcial' | 'Fora do ICP' | null {
  const mod = answers.modalidade;
  const renda = creditoRendaTotal(answers);
  if (mod === 'Construção') {
    const vt = parseMoney(answers.valor_terreno) ?? 0;
    const sd = parseMoney(answers.saldo_devedor_terreno) ?? 0;
    const terrenoOk = ['Sim, em meu nome', 'Nome de PJ'].includes(answers.rgi_nome || '') && vt > 0 && (vt - sd) / vt >= 0.5;
    const projetoOk = answers.projeto_aprovado === 'Sim';
    if (terrenoOk && projetoOk && renda >= 20000) return 'ICP';
    if (terrenoOk || projetoOk) return 'Parcial';
    return 'Fora do ICP';
  }
  if (mod === 'Home Equity') {
    return answers.averbacao === 'Sim' && answers.em_nome_cliente === 'Sim' && renda > 6000 ? 'ICP' : 'Fora do ICP';
  }
  return null;
}

export function creditoAnswersToSummary(answers: CreditoAnswers, sdrName?: string, channel?: 'whatsapp' | 'call'): string {
  const dateStr = new Date().toLocaleDateString('pt-BR');
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const channelLabel = channel === 'call' ? ' (Ligação)' : channel === 'whatsapp' ? ' (WhatsApp)' : '';
  const lines: string[] = [`📋 QUALIFICAÇÃO CRÉDITO${channelLabel} — ${dateStr} às ${timeStr}`];
  if (sdrName) lines.push(`Por: ${sdrName}`);
  const icp = previewCreditoIcp(answers);
  if (icp) lines.push(`Classificação: ${icp}`);
  const renda = creditoRendaTotal(answers);
  if (renda > 0) lines.push(`Renda considerada: R$ ${renda.toLocaleString('pt-BR')}`);
  lines.push('');
  for (const q of creditoVisibleQuestions(answers)) {
    const a = (answers[q.key] || '').trim();
    if (!a) continue;
    if (q.section) lines.push(`— ${q.section.toUpperCase()} —`);
    lines.push(`▸ ${q.label}`);
    lines.push(`  ${q.type === 'money' ? `R$ ${(parseMoney(a) ?? 0).toLocaleString('pt-BR')}` : a}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}
