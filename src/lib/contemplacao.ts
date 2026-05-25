export type MotivoContemplacao = 'sorteio' | 'lance' | 'lance_fixo';

export interface ResultadoVerificacaoLoteria {
  contemplado: boolean;
  distancia: number;
  mensagem: string;
}

export interface SimulacaoLance {
  percentualLance: number;
  posicaoEstimada: number;
  chanceContemplacao: 'baixa' | 'media' | 'alta' | 'muito_alta';
  mensagem: string;
}

/**
 * Extrai os últimos 4 dígitos de um número de cota
 */
export function extrairUltimos4Digitos(numero: string): string {
  const apenasNumeros = numero.replace(/\D/g, '');
  return apenasNumeros.slice(-4).padStart(4, '0');
}

/**
 * Verifica se a cota foi contemplada pelo sorteio da loteria federal
 * Compara os últimos 4 dígitos da cota com o resultado da loteria
 */
export function verificarContemplacao(cota: string, resultadoLoteria: string): ResultadoVerificacaoLoteria {
  const ultimosCota = extrairUltimos4Digitos(cota);
  const ultimosLoteria = extrairUltimos4Digitos(resultadoLoteria);
  
  const contemplado = ultimosCota === ultimosLoteria;
  const distancia = calcularDistanciaNumeros(ultimosCota, ultimosLoteria);
  
  let mensagem: string;
  if (contemplado) {
    mensagem = '🎉 CONTEMPLADO! Os números coincidem!';
  } else if (distancia <= 10) {
    mensagem = `Muito próximo! Diferença de apenas ${distancia}`;
  } else if (distancia <= 100) {
    mensagem = `Próximo. Diferença de ${distancia}`;
  } else if (distancia <= 500) {
    mensagem = `Razoável. Diferença de ${distancia}`;
  } else {
    mensagem = `Não contemplado. Diferença de ${distancia}`;
  }
  
  return {
    contemplado,
    distancia,
    mensagem,
  };
}

/**
 * Calcula a distância numérica entre dois números de 4 dígitos
 */
export function calcularDistanciaNumeros(numero1: string, numero2: string): number {
  const n1 = parseInt(numero1, 10);
  const n2 = parseInt(numero2, 10);
  return Math.abs(n1 - n2);
}

/**
 * Simula a chance de contemplação por lance baseado no percentual oferecido
 * Usa faixas típicas de mercado para estimar posição e chance
 */
export function simularChanceLance(
  valorCredito: number,
  percentualLance: number
): SimulacaoLance {
  const valorLance = (valorCredito * percentualLance) / 100;
  
  // Faixas típicas de mercado (podem ser ajustadas com dados reais)
  let chanceContemplacao: SimulacaoLance['chanceContemplacao'];
  let posicaoEstimada: number;
  let mensagem: string;
  
  if (percentualLance < 15) {
    chanceContemplacao = 'baixa';
    posicaoEstimada = Math.floor(Math.random() * 30) + 20; // Posição 20-50
    mensagem = `Lance de ${percentualLance}% (${formatCurrency(valorLance)}) tem baixa chance. Considere aumentar para 20%+.`;
  } else if (percentualLance < 25) {
    chanceContemplacao = 'media';
    posicaoEstimada = Math.floor(Math.random() * 15) + 10; // Posição 10-25
    mensagem = `Lance de ${percentualLance}% (${formatCurrency(valorLance)}) tem chance média. Pode contemplar em grupos menores.`;
  } else if (percentualLance < 35) {
    chanceContemplacao = 'alta';
    posicaoEstimada = Math.floor(Math.random() * 8) + 3; // Posição 3-11
    mensagem = `Lance de ${percentualLance}% (${formatCurrency(valorLance)}) tem boa chance! Competitivo na maioria dos grupos.`;
  } else {
    chanceContemplacao = 'muito_alta';
    posicaoEstimada = Math.floor(Math.random() * 3) + 1; // Posição 1-3
    mensagem = `Lance de ${percentualLance}% (${formatCurrency(valorLance)}) tem excelente chance! Provavelmente estará entre os primeiros.`;
  }
  
  return {
    percentualLance,
    posicaoEstimada,
    chanceContemplacao,
    mensagem,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Retorna a cor do badge baseado na chance de contemplação
 */
export function getCorChanceLance(chance: SimulacaoLance['chanceContemplacao']): string {
  switch (chance) {
    case 'baixa':
      return 'bg-red-100 text-red-800';
    case 'media':
      return 'bg-yellow-100 text-yellow-800';
    case 'alta':
      return 'bg-green-100 text-green-800';
    case 'muito_alta':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export const MOTIVO_CONTEMPLACAO_OPTIONS = [
  { value: 'sorteio', label: 'Sorteio Loteria Federal' },
  { value: 'lance', label: 'Lance Livre' },
  { value: 'lance_fixo', label: 'Lance Fixo' },
] as const;

// --- Simulador por Loteria Federal (regras Embracon) ---

export type ZonaChance = 'match_sorteio' | 'zona_50' | 'zona_100' | 'fora';

export interface CotaClassificada {
  card: import('@/types/consorcio').ConsorcioCard;
  zona: ZonaChance;
  distancia: number;
  recomendacaoLance: string;
  categoriaLabel: string;
}

export interface ResultadoFallback {
  numeroBase: string;
  numeroAplicado: number;
  fallbackAplicado: boolean;
  motivoFallback: string;
  candidatosTestados: { candidato: number; valido: boolean; motivo: string }[];
}

/**
 * Extrai os últimos 5 dígitos de um número (regra Embracon)
 */
export function extrairNumeroBase(numero: string): string {
  const apenasNumeros = numero.replace(/\D/g, '');
  return apenasNumeros.slice(-5).padStart(5, '0');
}

/**
 * Calcula o número aplicado com fallback por redução de dígitos.
 * Testa 5 → 4 → 3 → 2 → 1 dígitos até encontrar um dentro do range do grupo.
 */
export function calcularNumeroAplicado(
  numeroLoteria: string,
  maxCota: number
): ResultadoFallback {
  const apenasNumeros = numeroLoteria.replace(/\D/g, '');
  const numeroBase = apenasNumeros.slice(-5).padStart(5, '0');
  const candidatosTestados: ResultadoFallback['candidatosTestados'] = [];
  const invalidosNomes: string[] = [];

  for (let digitos = 5; digitos >= 1; digitos--) {
    const candidatoStr = apenasNumeros.slice(-digitos);
    const candidato = parseInt(candidatoStr, 10);

    if (candidato >= 1 && candidato <= maxCota) {
      candidatosTestados.push({ candidato, valido: true, motivo: 'dentro do range' });
      const fallbackAplicado = digitos < 5;
      const motivoFallback = fallbackAplicado
        ? `${invalidosNomes.join(' e ')} fora do range (max: ${maxCota}), usando ${candidato}`
        : '';
      return { numeroBase, numeroAplicado: candidato, fallbackAplicado, motivoFallback, candidatosTestados };
    } else {
      const motivo = candidato < 1 ? 'menor que 1' : `maior que max_cota (${maxCota})`;
      candidatosTestados.push({ candidato, valido: false, motivo });
      invalidosNomes.push(String(candidato));
    }
  }

  return {
    numeroBase,
    numeroAplicado: parseInt(numeroBase, 10),
    fallbackAplicado: false,
    motivoFallback: 'Nenhum candidato válido encontrado',
    candidatosTestados,
  };
}

/**
 * Classifica cotas em zonas de chance baseado no número da Loteria Federal.
 * Aplica fallback automático por redução de dígitos quando o número está fora do range.
 */
export function classificarCotasPorLoteria(
  numeroLoteria: string,
  cards: import('@/types/consorcio').ConsorcioCard[]
): { classificados: CotaClassificada[]; fallback: ResultadoFallback } {
  let maxCota = 0;
  for (const card of cards) {
    const cotaNum = parseInt(card.cota.replace(/\D/g, ''), 10);
    if (!isNaN(cotaNum) && cotaNum > maxCota) maxCota = cotaNum;
  }
  if (maxCota === 0) maxCota = 9999;

  const fallback = calcularNumeroAplicado(numeroLoteria, maxCota);
  const nBase = fallback.numeroAplicado;
  const resultados: CotaClassificada[] = [];

  for (const card of cards) {
    const cotaNum = parseInt(card.cota.replace(/\D/g, ''), 10);
    if (isNaN(cotaNum)) continue;
    const distancia = Math.abs(cotaNum - nBase);

    let zona: ZonaChance;
    let recomendacaoLance: string;
    let categoriaLabel: string;

    if (distancia === 0) {
      zona = 'match_sorteio';
      recomendacaoLance = 'Contemplação por sorteio';
      categoriaLabel = 'Match Sorteio';
    } else if (distancia <= 50) {
      zona = 'zona_50';
      recomendacaoLance = 'Até 25%';
      categoriaLabel = 'Zona ±50';
    } else if (distancia <= 100) {
      zona = 'zona_100';
      recomendacaoLance = 'Até 50%';
      categoriaLabel = 'Zona ±100';
    } else {
      continue;
    }
    resultados.push({ card, zona, distancia, recomendacaoLance, categoriaLabel });
  }

  const zonaOrder: Record<ZonaChance, number> = { match_sorteio: 0, zona_50: 1, zona_100: 2, fora: 3 };
  resultados.sort((a, b) => zonaOrder[a.zona] - zonaOrder[b.zona] || a.distancia - b.distancia);

  return { classificados: resultados, fallback };
}

/**
 * Retorna cor do badge baseado na zona de chance
 */
export function getCorZona(zona: ZonaChance): string {
  switch (zona) {
    case 'match_sorteio':
      return 'bg-emerald-600 text-white';
    case 'zona_50':
      return 'bg-blue-600 text-white';
    case 'zona_100':
      return 'bg-yellow-500 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// --- Simulação de posição no ranking e recomendação de lance ---

export type LanceRecomendado = 0 | 25 | 50;

export interface RecomendacaoCota {
  card: import('@/types/consorcio').ConsorcioCard;
  distancia: number;
  posicaoSemLance: number;
  posicaoCom25: number;
  posicaoCom50: number;
  vagas: number;
  totalCotas: number;
  percentualRecomendado: LanceRecomendado | null; // null = não compensa
  valorLanceRecomendado: number;
  chancePercent: number; // 0-100
  chanceLabel: 'Sorteio' | 'Muito alta' | 'Alta' | 'Média' | 'Baixa' | 'Nenhuma';
  justificativa: string;
}

/**
 * Simula posição da cota no ranking de contemplação considerando lance.
 * Lógica: cotas com lance maior sobem; entre cotas com mesmo lance (ou sem lance),
 * ordena pela distância do número aplicado (Embracon usa proximidade como critério).
 */
function calcularPosicao(
  cotaAlvo: import('@/types/consorcio').ConsorcioCard,
  todasCotas: import('@/types/consorcio').ConsorcioCard[],
  numeroAplicado: number,
  percentualLanceAlvo: number,
): number {
  const cotaAlvoNum = parseInt(cotaAlvo.cota.replace(/\D/g, ''), 10);
  const distanciaAlvo = Math.abs(cotaAlvoNum - numeroAplicado);
  let melhoresQueElaSemLance = 0;

  for (const outra of todasCotas) {
    if (outra.id === cotaAlvo.id) continue;
    if (outra.motivo_contemplacao) continue; // já contemplada
    const outraNum = parseInt(outra.cota.replace(/\D/g, ''), 10);
    if (isNaN(outraNum)) continue;
    const distOutra = Math.abs(outraNum - numeroAplicado);
    // Outra está à frente se: distância menor (sem considerar lance dela, modelo conservador)
    if (distOutra < distanciaAlvo) melhoresQueElaSemLance += 1;
  }

  // Cotas com lance > alvo ocupariam slot antes (assumimos 0% para outros = modelo otimista)
  // Modelo simples: posição = (cotas mais próximas) + 1, lance só ajuda a "garantir slot" se for >= 25%
  // Quanto maior o lance, mais "neutraliza" as cotas próximas (cada 25% reduz competidores próximos pela metade)
  const fatorReducao = percentualLanceAlvo >= 50 ? 0.25 : percentualLanceAlvo >= 25 ? 0.5 : 1;
  return Math.max(1, Math.round(melhoresQueElaSemLance * fatorReducao) + 1);
}

function classificarChance(posicao: number, vagas: number): RecomendacaoCota['chanceLabel'] {
  if (posicao <= vagas) return posicao === 1 ? 'Muito alta' : 'Alta';
  if (posicao <= vagas * 2) return 'Média';
  if (posicao <= vagas * 4) return 'Baixa';
  return 'Nenhuma';
}

function chanceParaPercent(posicao: number, vagas: number): number {
  if (posicao <= vagas) return Math.round(100 - (posicao - 1) * (15 / Math.max(1, vagas)));
  const excedente = posicao - vagas;
  return Math.max(2, Math.round(70 / (1 + excedente * 0.6)));
}

/**
 * Para uma cota, recomenda o menor lance (0 → 25 → 50) que coloca dentro das vagas.
 * Se nem 50% resolve, retorna null em percentualRecomendado.
 */
export function recomendarLanceParaCota(
  cota: import('@/types/consorcio').ConsorcioCard,
  todasCotas: import('@/types/consorcio').ConsorcioCard[],
  numeroAplicado: number,
  vagas: number,
): RecomendacaoCota {
  const cotaNum = parseInt(cota.cota.replace(/\D/g, ''), 10);
  const distancia = isNaN(cotaNum) ? 99999 : Math.abs(cotaNum - numeroAplicado);

  const posicaoSemLance = calcularPosicao(cota, todasCotas, numeroAplicado, 0);
  const posicaoCom25 = calcularPosicao(cota, todasCotas, numeroAplicado, 25);
  const posicaoCom50 = calcularPosicao(cota, todasCotas, numeroAplicado, 50);

  let percentualRecomendado: LanceRecomendado | null;
  let posicaoFinal: number;
  let justificativa: string;

  if (distancia === 0) {
    percentualRecomendado = 0;
    posicaoFinal = 1;
    justificativa = 'Match com sorteio — contemplação direta, sem necessidade de lance.';
  } else if (posicaoSemLance <= vagas) {
    percentualRecomendado = 0;
    posicaoFinal = posicaoSemLance;
    justificativa = `Já está entre as ${vagas} primeiras pela proximidade. Pode esperar sorteio.`;
  } else if (posicaoCom25 <= vagas) {
    percentualRecomendado = 25;
    posicaoFinal = posicaoCom25;
    justificativa = 'Lance de 25% garante entrada nas vagas — não vale dar 50%.';
  } else if (posicaoCom50 <= vagas) {
    percentualRecomendado = 50;
    posicaoFinal = posicaoCom50;
    justificativa = '25% não basta; com 50% entra nas vagas.';
  } else {
    percentualRecomendado = null;
    posicaoFinal = posicaoCom50;
    justificativa = `Mesmo com 50% fica em ${posicaoCom50}º. Lance não compensa — esperar próxima assembleia.`;
  }

  const valorCredito = Number(cota.valor_credito) || 0;
  const valorLanceRecomendado =
    percentualRecomendado && percentualRecomendado > 0
      ? (valorCredito * percentualRecomendado) / 100
      : 0;

  return {
    card: cota,
    distancia,
    posicaoSemLance,
    posicaoCom25,
    posicaoCom50,
    vagas,
    totalCotas: todasCotas.length,
    percentualRecomendado,
    valorLanceRecomendado,
    chancePercent: distancia === 0 ? 100 : chanceParaPercent(posicaoFinal, vagas),
    chanceLabel: distancia === 0 ? 'Sorteio' : classificarChance(posicaoFinal, vagas),
    justificativa,
  };
}

/**
 * Aplica recomendação em todas as cotas do grupo, ordenando por chance.
 */
export function recomendarLancesGrupo(
  cards: import('@/types/consorcio').ConsorcioCard[],
  numeroAplicado: number,
  vagas: number = 2,
): RecomendacaoCota[] {
  const ativas = cards.filter((c) => !c.motivo_contemplacao);
  const recs = ativas.map((c) => recomendarLanceParaCota(c, ativas, numeroAplicado, vagas));
  const ordemChance: Record<RecomendacaoCota['chanceLabel'], number> = {
    Sorteio: 0,
    'Muito alta': 1,
    Alta: 2,
    'Média': 3,
    Baixa: 4,
    Nenhuma: 5,
  };
  return recs.sort(
    (a, b) => ordemChance[a.chanceLabel] - ordemChance[b.chanceLabel] || a.distancia - b.distancia,
  );
}

export function getCorChanceLabel(label: RecomendacaoCota['chanceLabel']): string {
  switch (label) {
    case 'Sorteio':
      return 'bg-emerald-600 text-white';
    case 'Muito alta':
      return 'bg-emerald-500 text-white';
    case 'Alta':
      return 'bg-blue-600 text-white';
    case 'Média':
      return 'bg-yellow-500 text-white';
    case 'Baixa':
      return 'bg-orange-500 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// --- Motor baseado em faixas configuráveis + histórico ---

export interface FaixaInput {
  tipo_produto: string;
  distancia_min: number;
  distancia_max: number | null;
  percentual_lance: number | null;
}

export interface RecomendacaoFaixa {
  card: import('@/types/consorcio').ConsorcioCard;
  distancia: number;
  faixaAplicada: string; // ex: "0-50", "51-100", ">100"
  percentualSugerido: number | null; // null = não compensa
  posicao: number;
  vagas: number;
  chanceLabel: 'Sorteio' | 'Alta' | 'Média' | 'Baixa' | 'Fora';
  chancePercent: number;
  valorLance: number;
  justificativa: string;
}

/**
 * Encontra a faixa correspondente para uma dada distância e categoria de bem.
 */
export function buscarFaixa(faixas: FaixaInput[], categoria: string, distancia: number): FaixaInput | null {
  const dasCategoria = faixas.filter((f) => f.tipo_produto === categoria);
  for (const f of dasCategoria) {
    const max = f.distancia_max ?? Infinity;
    if (distancia >= f.distancia_min && distancia <= max) return f;
  }
  return null;
}

function rotuloFaixa(f: FaixaInput): string {
  if (f.distancia_max === null) return `>${f.distancia_min - 1}`;
  if (f.distancia_min === 0) return `0–${f.distancia_max}`;
  return `${f.distancia_min}–${f.distancia_max}`;
}

/**
 * Aplica o motor de 3 camadas para cada cota do grupo.
 */
export function calcularRecomendacoesPorFaixa(
  cards: import('@/types/consorcio').ConsorcioCard[],
  numeroAplicado: number,
  categoria: string,
  faixas: FaixaInput[],
  vagas: number,
): RecomendacaoFaixa[] {
  const ativas = cards.filter((c) => !c.motivo_contemplacao);

  // Calcula distância de todas
  const comDistancia = ativas.map((c) => {
    const num = parseInt(c.cota.replace(/\D/g, ''), 10);
    const distancia = isNaN(num) ? 99999 : Math.abs(num - numeroAplicado);
    return { card: c, distancia };
  });

  // Ordena por distância para definir ranking (posição)
  const ordenadas = [...comDistancia].sort((a, b) => a.distancia - b.distancia);

  return comDistancia
    .map(({ card, distancia }) => {
      const faixa = buscarFaixa(faixas, categoria, distancia);
      const posicao = ordenadas.findIndex((x) => x.card.id === card.id) + 1;

      let percentualSugerido: number | null;
      let chanceLabel: RecomendacaoFaixa['chanceLabel'];
      let chancePercent: number;
      let justificativa: string;
      let faixaAplicada: string;

      if (!faixa) {
        percentualSugerido = null;
        chanceLabel = 'Fora';
        chancePercent = 0;
        faixaAplicada = '—';
        justificativa = `Nenhuma faixa configurada para "${categoria}" cobre distância ${distancia}.`;
      } else {
        faixaAplicada = rotuloFaixa(faixa);
        percentualSugerido = faixa.percentual_lance;

        if (distancia === 0) {
          chanceLabel = 'Sorteio';
          chancePercent = 100;
          percentualSugerido = 0;
          justificativa = 'Match exato com sorteio — contemplação direta, sem lance.';
        } else if (faixa.percentual_lance === null) {
          chanceLabel = 'Fora';
          chancePercent = 2;
          justificativa = `Faixa ${faixaAplicada} marcada como "não compensa" para ${categoria}.`;
        } else if (posicao <= vagas) {
          chanceLabel = 'Alta';
          chancePercent = Math.round(85 - (posicao - 1) * 10);
          justificativa = `Está em ${posicao}º de ${vagas} vagas estimadas. Faixa ${faixaAplicada} → lance de ${faixa.percentual_lance}%.`;
        } else if (posicao <= vagas * 2) {
          chanceLabel = 'Média';
          chancePercent = Math.round(50 - (posicao - vagas) * 5);
          justificativa = `Disputado: ${posicao}º para ${vagas} vagas. Lance ${faixa.percentual_lance}% é tentativa válida.`;
        } else {
          chanceLabel = 'Baixa';
          chancePercent = Math.max(5, Math.round(25 - (posicao - vagas * 2) * 2));
          justificativa = `Arriscado: ${posicao}º para ${vagas} vagas. Lance ${faixa.percentual_lance}% pode não ser suficiente.`;
        }
      }

      const valorLance = percentualSugerido && percentualSugerido > 0
        ? (Number(card.valor_credito) * percentualSugerido) / 100
        : 0;

      return {
        card,
        distancia,
        faixaAplicada,
        percentualSugerido,
        posicao,
        vagas,
        chanceLabel,
        chancePercent,
        valorLance,
        justificativa,
      };
    })
    .sort((a, b) => {
      const ordem: Record<RecomendacaoFaixa['chanceLabel'], number> = { Sorteio: 0, Alta: 1, 'Média': 2, Baixa: 3, Fora: 4 };
      return ordem[a.chanceLabel] - ordem[b.chanceLabel] || a.distancia - b.distancia;
    });
}

export function getCorChanceFaixa(label: RecomendacaoFaixa['chanceLabel']): string {
  switch (label) {
    case 'Sorteio': return 'bg-emerald-600 text-white';
    case 'Alta': return 'bg-blue-600 text-white';
    case 'Média': return 'bg-yellow-500 text-white';
    case 'Baixa': return 'bg-orange-500 text-white';
    default: return 'bg-muted text-muted-foreground';
  }
}
