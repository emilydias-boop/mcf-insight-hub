// Stage IDs for Consórcio pipelines (Efeito Alavanca + Viver de Aluguel)

// VdA: PIPELINE - INSIDE SALES - VIVER DE ALUGUEL
export const VDA_PROPOSTA_ENVIADA_STAGE_ID = "09a0a99e-feee-46df-a817-bc4d0e1ac3d9";
export const VDA_VENDA_REALIZADA_STAGE_ID = "aa194279-c40e-458d-80aa-c5179b414658";
export const VDA_CONTRATO_PAGO_STAGE_ID = "a35fea26-805e-40d5-b604-56fd6319addf";

// EA: Efeito Alavanca + Clube
export const EA_PRODUTOS_FECHADOS_STAGE_ID = "2357df56-bfad-4c4c-b37b-c5f41ce08af6";
export const EA_VENDA_REALIZADA_50K_STAGE_ID = "cee41f5d-aad9-435d-a6ee-a96bbda6f257";

// Stages that count as "Proposta Enviada" (sinal real de proposta)
export const CONSORCIO_PROPOSTA_STAGE_IDS = [
  VDA_PROPOSTA_ENVIADA_STAGE_ID,
];

// Stages that count as "Produto Fechado / Venda" no Consórcio
export const CONSORCIO_FECHAMENTO_STAGE_IDS = [
  VDA_VENDA_REALIZADA_STAGE_ID,
  VDA_CONTRATO_PAGO_STAGE_ID,
  EA_PRODUTOS_FECHADOS_STAGE_ID,
  EA_VENDA_REALIZADA_50K_STAGE_ID,
];
