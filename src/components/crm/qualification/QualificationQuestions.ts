export const MIN_ANSWER_LENGTH = 15;

export interface QualificationQuestion {
  key: string;
  label: string;
  placeholder?: string;
}

export const QUALIFICATION_QUESTIONS: QualificationQuestion[] = [
  {
    key: 'tempo_mcf',
    label: 'Há quanto tempo o lead conhece a MCF?',
    placeholder: 'Ex: Conhece a MCF há cerca de 6 meses pelo Instagram...',
  },
  {
    key: 'profissao',
    label: 'Qual a profissão do lead?',
    placeholder: 'Ex: É engenheiro civil, trabalha em construtora há 10 anos...',
  },
  {
    key: 'socio',
    label: 'Possui algum sócio?',
    placeholder: 'Ex: Sim, tem um sócio chamado João, dividem 50/50... (ou: Não possui sócio, atua sozinho na empresa)',
  },
  {
    key: 'renda',
    label: 'Qual a renda estimada do lead?',
    placeholder: 'Ex: Renda mensal aproximada de R$ 25.000 entre PJ e PF...',
  },
  {
    key: 'constroi_venda',
    label: 'O lead já constrói para venda?',
    placeholder: 'Ex: Já construiu 2 casas para venda nos últimos anos... (ou: Nunca construiu, pretende começar agora)',
  },
  {
    key: 'terreno_imovel',
    label: 'O lead possui terreno ou imóvel (casa ou apartamento)?',
    placeholder: 'Ex: Possui um terreno de 300m² em SP e uma casa própria...',
  },
];

export type QualificationAnswers = Record<string, string>;

export function validateAnswers(answers: QualificationAnswers): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const q of QUALIFICATION_QUESTIONS) {
    const v = (answers[q.key] || '').trim();
    if (v.length < MIN_ANSWER_LENGTH) missing.push(q.key);
  }
  return { valid: missing.length === 0, missing };
}

export function answersToSummary(answers: QualificationAnswers, sdrName?: string): string {
  const dateStr = new Date().toLocaleDateString('pt-BR');
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const lines: string[] = [];
  lines.push(`📋 QUALIFICAÇÃO (WhatsApp) — ${dateStr} às ${timeStr}`);
  if (sdrName) lines.push(`Por: ${sdrName}`);
  lines.push('');
  for (const q of QUALIFICATION_QUESTIONS) {
    const a = (answers[q.key] || '').trim();
    if (a) {
      lines.push(`▸ ${q.label}`);
      lines.push(`  ${a}`);
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}