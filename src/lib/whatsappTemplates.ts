// WhatsApp message templates by stage
export const WHATSAPP_TEMPLATES: Record<string, string> = {
  'Novo Lead': `Olá {{nome}}! 👋

Aqui é {{sdr}} da MCF. Vi que você demonstrou interesse no nosso conteúdo!

Gostaria de agendar uma conversa rápida para entender melhor seu momento. Que tal?`,

  'Reunião 01 Agendada': `Oi {{nome}}! 👋

Lembrete que nossa reunião está agendada para {{data}}. 

Confirma sua presença? 📅`,

  'R1 Agendada': `Oi {{nome}}! 👋

Lembrete que nossa reunião está agendada para {{data}}. 

Confirma sua presença? 📅`,

  'No-Show': `Oi {{nome}}!

Não conseguimos nos falar hoje. Tudo bem?

Posso reagendar nossa conversa? Qual o melhor horário pra você?`,

  'Reunião 01 Realizada': `Olá {{nome}}!

Foi ótimo conversar com você! 

Se tiver alguma dúvida sobre o que conversamos, estou à disposição.`,

  'R1 Realizada': `Olá {{nome}}!

Foi ótimo conversar com você! 

Se tiver alguma dúvida sobre o que conversamos, estou à disposição.`,

  'Reunião 02 Agendada': `Oi {{nome}}!

Confirmando nossa próxima reunião para {{data}}.

Estou animado para continuarmos! 🚀`,

  'R2 Agendada': `Oi {{nome}}!

Confirmando nossa próxima reunião para {{data}}.

Estou animado para continuarmos! 🚀`,

  'Contrato Pago': `Parabéns {{nome}}! 🎉

Seja muito bem-vindo(a) à família MCF!

Em breve você receberá todas as informações de acesso.`,

  'Em Contato': `Olá {{nome}}!

Passando para saber se teve tempo de analisar nossa proposta.

Ficou alguma dúvida que eu possa esclarecer?`,

  'Qualificado': `Olá {{nome}}!

Analisando seu perfil, acredito que podemos ajudar você a alcançar seus objetivos.

Podemos agendar uma conversa?`,

  // Template padrão
  'default': `Olá {{nome}}! 

Aqui é {{sdr}} da equipe MCF. Como posso ajudar?`
};

export interface WhatsAppTemplateVariables {
  nome?: string;
  sdr?: string;
  data?: string;
  produto?: string;
}

export function buildWhatsAppMessage(
  stageName: string,
  variables: WhatsAppTemplateVariables
): string {
  // Get template for stage or use default
  const template = WHATSAPP_TEMPLATES[stageName] || WHATSAPP_TEMPLATES['default'];
  
  let message = template;
  
  // Replace variables
  if (variables.nome) {
    message = message.replace(/\{\{nome\}\}/g, variables.nome);
  }
  if (variables.sdr) {
    message = message.replace(/\{\{sdr\}\}/g, variables.sdr);
  }
  if (variables.data) {
    message = message.replace(/\{\{data\}\}/g, variables.data);
  }
  if (variables.produto) {
    message = message.replace(/\{\{produto\}\}/g, variables.produto);
  }
  
  // Remove unreplaced variables (show as empty)
  message = message.replace(/\{\{[^}]+\}\}/g, '');
  
  return encodeURIComponent(message.trim());
}

export function getAvailableTemplates(): string[] {
  return Object.keys(WHATSAPP_TEMPLATES).filter(k => k !== 'default');
}
