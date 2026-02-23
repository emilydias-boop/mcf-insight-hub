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
