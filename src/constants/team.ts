// Lista completa de SDRs da Pipeline Inside Sales
export const SDR_LIST = [
  { nome: "Juliana Rodrigues", email: "juliana.rodrigues@minhacasafinanciada.com" },
  { nome: "Julia Caroline", email: "julia.caroline@minhacasafinanciada.com" },
  { nome: "Antony Elias", email: "antony.elias@minhacasafinanciada.com" },
  { nome: "Vinicius Rangel", email: "rangel.vinicius@minhacasafinanciada.com" },
  { nome: "Jessica Martins", email: "jessica.martins@minhacasafinanciada.com" },
  { nome: "Leticia Nunes", email: "leticia.nunes@minhacasafinanciada.com" },
  { nome: "Caroline Correa", email: "carol.correa@minhacasafinanciada.com" },
  { nome: "Caroline Souza", email: "caroline.souza@minhacasafinanciada.com" },
];

// Lista de Closers (para validação)
export const CLOSER_LIST = [
  { nome: "Thayna", variations: ["thayna", "Thayna", "thaynar", "Thaynar", "Thayna Dos Santos", "Thayna Dos Santos Tavares"] },
  { nome: "Deisi", variations: ["deisi", "Deisi", "DEISE", "deise", "Deisiele", "Deisiele Vieira"] },
  { nome: "Leticia", variations: ["leticia", "Leticia", "LETICIA", "Letícia", "Leticia Correia"] },
  { nome: "Julio", variations: ["julio", "Julio", "Júlio", "JULIO", "Julio Caetano"] },
  { nome: "Jessica Bellini", variations: ["jessica bellini", "Jessica Bellini", "Jéssica Bellini", "jéssica bellini", "bellini"] },
];

// Produtos que disparam confetti (case insensitive, busca parcial)
export const CONFETTI_PRODUCTS = [
  // Contratos específicos (apenas A000 e Anticrise)
  "A000 - Contrato",      // Contrato Lead A/B
  "Contrato - Anticrise", // Anticrise explícito
  
  // Parcerias (A001, A002, A003, A004, A009)
  "MCF INCORPORADOR",     // A001, A002, A009
  "MCF Plano Anticrise",  // A003, A004
  "Plano Construtor",     // Plano Construtor Básico
  "A009",                 // A009 explícito (mesmo com THE CLUB no nome)
];

// Produtos que NÃO disparam confetti (mesmo se contiverem palavras do CONFETTI_PRODUCTS)
export const CONFETTI_EXCLUDE_PRODUCTS = [
  "Clube do Arremate",  // Exclui "Contrato - Clube do Arremate" também
  "P2",                 // MCF P2 - não é parceria
  "Sócio",              // Sócio MCF - não é parceria  
  "THE CLUB",           // Não é parceria
  "Efeito Alavanca",    // Não é parceria
];

// Lista de responsáveis por preencher R2
export const R2_BOOKERS_LIST = [
  { id: '04bb4045-701d-443c-b2c9-aee74e7f58d9', nome: 'Yanca Oliveira' },
  { id: 'dd76c153-a4a5-432e-ab4c-0b48f6141659', nome: 'Julio Caetano' },
  { id: 'c8fd2b83-2aee-41a4-9154-e812f492bc5f', nome: 'Cristiane Gomes' },
  { id: '6bb81a27-fd8f-4af8-bce0-377f3576124f', nome: 'Thaynar Tavares' },
];

// ID da origem PIPELINE INSIDE SALES
export const INSIDE_SALES_ORIGIN_ID = "e3c04f21-ba2c-4c66-84f8-b4341c826b1c";

// Stages importantes do pipeline (nomes reais do banco)
export const PIPELINE_STAGES = {
  NOVO_LEAD: "Novo Lead",
  R1_AGENDADA: "Reunião 01 Agendada",
  R1_REALIZADA: "Reunião 01 Realizada",
  NO_SHOW: "No-Show",
  CONTRATO_PAGO: "Contrato Pago",
};
