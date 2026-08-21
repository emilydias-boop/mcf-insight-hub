/**
 * Dicionário de RÓTULOS do Consórcio (somente apresentação).
 *
 * Regra: nunca traduza chaves de banco. `crm_stages.name`,
 * `team_targets.target_type`, `team_targets.target_name`, `status` e
 * `tipo_registro` continuam exatamente como estão gravados — o que muda é
 * apenas o texto que o usuário lê nas telas da BU Consórcio.
 *
 * A divergência com o Incorporador (que segue usando "R1") é decisão
 * consciente do dono: NÃO reaproveite este dicionário em telas do Incorporador.
 */
export const CONSORCIO_LABELS = {
  reunioesAgendadas: 'Reuniões Agendadas',
  reunioesRealizadas: 'Reuniões Realizadas',
  reuniaoAgendada: 'Reuniões Agendadas',
  reuniaoRealizada: 'Reuniões Realizadas',
  termosPendentes: 'Termos de Adesão Pendentes',
  cotasAFazer: 'Cotas a Fazer',
  cotasCadastradas: 'Cotas Cadastradas',
  cotas: 'Cotas',
  lancarVenda: 'Lançar Venda',
  convVendasReuniao: 'Conv. Vendas / Reunião',
  conversaoVendasReuniao: 'Conversão Vendas / Reunião',
  /** Uso em textos corridos e tooltips ("÷ Reuniões Realizadas"). */
  reuniao: 'Reunião',
} as const;

/** Rótulos antigos → novos. A chave é o texto legado que ainda aparece no código/banco. */
const MAPA_ROTULOS: Record<string, string> = {
  'R1 Agendada': CONSORCIO_LABELS.reunioesAgendadas,
  'R1 Agendadas': CONSORCIO_LABELS.reunioesAgendadas,
  'R1 Realizada': CONSORCIO_LABELS.reunioesRealizadas,
  'R1 Realizadas': CONSORCIO_LABELS.reunioesRealizadas,
  'Cartas Negociadas': CONSORCIO_LABELS.termosPendentes,
  'Cadastros Pendentes': CONSORCIO_LABELS.cotasAFazer,
  'Cadastradas': CONSORCIO_LABELS.cotasCadastradas,
  'Cotas': CONSORCIO_LABELS.cotas,
  'Conv. Vendas / R1': CONSORCIO_LABELS.convVendasReuniao,
  'Conversão Vendas / R1': CONSORCIO_LABELS.conversaoVendasReuniao,
};

/**
 * Traduz um rótulo legado do Consórcio. Passe por aqui tudo que nasce de
 * `target_type` / `target_name` para não ficar metade da tela com cada grafia.
 */
export function rotuloConsorcio(legado: string | null | undefined): string {
  if (!legado) return '';
  return MAPA_ROTULOS[legado] ?? legado;
}
