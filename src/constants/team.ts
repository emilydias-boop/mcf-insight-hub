// Lista completa de SDRs da Pipeline Inside Sales
export const SDR_LIST = [
  { nome: "Cristiane Gomes", email: "cristiane.gomes@minhacasafinanciada.com" },
  { nome: "Juliana Rodrigues", email: "juliana.rodrigues@minhacasafinanciada.com" },
  { nome: "Angelina Maia", email: "angelina.maia@minhacasafinanciada.com" },
  { nome: "Julia Caroline", email: "julia.caroline@minhacasafinanciada.com" },
  { nome: "Antony Elias", email: "antony.elias@minhacasafinanciada.com" },
  { nome: "Vinicius Rangel", email: "rangel.vinicius@minhacasafinanciada.com" },
  { nome: "Cleiton Lima", email: "cleiton.lima@minhacasafinanciada.com" },
  { nome: "Jessica Martins", email: "jessica.martins@minhacasafinanciada.com" },
  { nome: "Leticia Nunes", email: "leticia.nunes@minhacasafinanciada.com" },
  { nome: "Vitor Costa", email: "vitor.ferreira@minhacasafinanciada.com" },
  { nome: "Caroline Correa", email: "carol.correa@minhacasafinanciada.com" },
  { nome: "Caroline Souza", email: "caroline.souza@minhacasafinanciada.com" },
  { nome: "Yanca Oliveira", email: "yanca.tavares@minhacasafinanciada.com" },
];

// Lista de Closers (para validação)
export const CLOSER_LIST = [
  { nome: "Thayna", variations: ["thayna", "Thayna", "thaynar", "Thaynar"] },
  { nome: "Deisi", variations: ["deisi", "Deisi", "DEISE", "deise"] },
  { nome: "Leticia", variations: ["leticia", "Leticia", "LETICIA", "Letícia"] },
  { nome: "Julio", variations: ["julio", "Julio", "Júlio", "JULIO"] },
];

// Produtos que disparam confetti (case insensitive, busca parcial)
export const CONFETTI_PRODUCTS = [
  // Contratos (contêm "Contrato" no nome)
  "Contrato",
  
  // Parcerias (A001, A002, A003, A004, A009)
  "MCF INCORPORADOR",     // A001, A002, A009
  "MCF Plano Anticrise",  // A003, A004
  "Plano Construtor",     // Plano Construtor Básico
];

// Produtos que NÃO disparam confetti (mesmo se contiverem palavras do CONFETTI_PRODUCTS)
export const CONFETTI_EXCLUDE_PRODUCTS = [
  "Clube do Arremate",  // Exclui "Contrato - Clube do Arremate" também
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
