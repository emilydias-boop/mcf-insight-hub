// Qualificação da BU Crédito Imobiliário. As opções abaixo são lidas por
// public.classify_credito_icp() no banco — manter os textos idênticos.
import { MIN_ANSWER_LENGTH } from './QualificationQuestions';

export type CreditoModalidade = 'Construção' | 'Home Equity' | 'Comprar imóvel';
export const CREDITO_MODALIDADES: CreditoModalidade[] = ['Construção', 'Home Equity', 'Comprar imóvel'];

export interface CreditoQuestion {
  key: string;
  label: string;
  type: 'choice' | 'money' | 'text';
  options?: string[];
  placeholder?: string;
  /** Só aparece para estas modalidades; ausente = sempre. */
  showWhen?: CreditoModalidade[];
  /** Pergunta informativa (não bloqueia o salvar). */
  optional?: boolean;
  help?: string;
}

export const CREDITO_QUALIFICATION_QUESTIONS: CreditoQuestion[] = [
  { key: 'modalidade', label: 'O que o lead quer fazer?', type: 'choice', options: CREDITO_MODALIDADES },
  { key: 'renda', label: 'Renda mensal comprovável (R$)', type: 'money', placeholder: 'Ex: 25000',
    help: 'Construção: ICP a partir de R$ 20.000. Home Equity: acima de R$ 6.000.' },
  // Construção
  { key: 'terreno', label: 'Situação do terreno', type: 'choice', showWhen: ['Construção'],
    options: ['Registrado e quitado', 'Registrado, 50% ou mais pago', 'Registrado, menos de 50% pago', 'Tem terreno, não registrado', 'Não tem terreno'] },
  { key: 'projeto_aprovado', label: 'Projeto de obra aprovado na prefeitura?', type: 'choice', showWhen: ['Construção'],
    options: ['Sim, aprovado', 'Em aprovação', 'Não'] },
  { key: 'imovel_proprio', label: 'Possui outro imóvel próprio?', type: 'choice', showWhen: ['Construção'], optional: true,
    options: ['Sim', 'Não'] },
  // Home Equity
  { key: 'imovel_regularizado', label: 'Situação do imóvel que será garantia', type: 'choice', showWhen: ['Home Equity'],
    options: ['Sim, com matrícula/escritura regular', 'Irregular / em regularização', 'Não tem imóvel'] },
  // Comprar imóvel (só informação; não tem ICP definido)
  { key: 'valor_imovel', label: 'Valor aproximado do imóvel desejado (R$)', type: 'money', showWhen: ['Comprar imóvel'], optional: true, placeholder: 'Ex: 450000' },
  { key: 'entrada_disponivel', label: 'Valor de entrada disponível (R$)', type: 'money', showWhen: ['Comprar imóvel'], optional: true, placeholder: 'Ex: 90000' },
  // Todas
  { key: 'observacoes', label: 'Observações do SDR', type: 'text', optional: true,
    placeholder: 'Ex: Terreno em Sorocaba, quer começar a obra em 6 meses, já conversou com a Caixa...' },
];

export type CreditoAnswers = Record<string, string>;

export function creditoVisibleQuestions(answers: CreditoAnswers): CreditoQuestion[] {
  const mod = (answers.modalidade || '') as CreditoModalidade;
  return CREDITO_QUALIFICATION_QUESTIONS.filter(q => !q.showWhen || (mod && q.showWhen.includes(mod)));
}

export function parseMoney(v: string | undefined): number | null {
  if (!v) return null;
  const digits = v.replace(/[^\d,\.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(digits);
  return isNaN(n) ? null : n;
}

export function creditoAnswerOk(q: CreditoQuestion, value: string): boolean {
  const v = (value || '').trim();
  if (q.type === 'choice') return v.length > 0;
  if (q.type === 'money') return (parseMoney(v) ?? 0) > 0;
  return v.length >= MIN_ANSWER_LENGTH;
}

/** Só as perguntas visíveis e não opcionais bloqueiam. */
export function validateCreditoAnswers(answers: CreditoAnswers): { valid: boolean; missing: string[] } {
  const missing = creditoVisibleQuestions(answers)
    .filter(q => !q.optional && !creditoAnswerOk(q, answers[q.key] || ''))
    .map(q => q.key);
  return { valid: missing.length === 0, missing };
}

/** Espelho da regra do banco (classify_credito_icp) só para pré-visualizar no formulário. O banco é a fonte da verdade. */
export function previewCreditoIcp(answers: CreditoAnswers): 'ICP' | 'Parcial' | 'Fora do ICP' | null {
  const mod = answers.modalidade;
  const renda = parseMoney(answers.renda) ?? 0;
  if (mod === 'Construção') {
    const terrenoOk = ['Registrado e quitado', 'Registrado, 50% ou mais pago'].includes(answers.terreno || '');
    const projetoOk = answers.projeto_aprovado === 'Sim, aprovado';
    if (terrenoOk && projetoOk && renda >= 20000) return 'ICP';
    if (terrenoOk || projetoOk) return 'Parcial';
    return 'Fora do ICP';
  }
  if (mod === 'Home Equity') {
    return answers.imovel_regularizado === 'Sim, com matrícula/escritura regular' && renda > 6000 ? 'ICP' : 'Fora do ICP';
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
  lines.push('');
  for (const q of creditoVisibleQuestions(answers)) {
    const a = (answers[q.key] || '').trim();
    if (a) { lines.push(`▸ ${q.label}`); lines.push(`  ${a}`); lines.push(''); }
  }
  return lines.join('\n').trim();
}
