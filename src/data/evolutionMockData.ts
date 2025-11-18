import { EvolutionData } from "@/types/dashboard";
import { getCustomWeeksInRange, addCustomWeeks, formatCustomWeekRangeShort } from "@/lib/dateHelpers";

/**
 * Gerar dados mock de evolução temporal
 * Usa semanas customizadas (sábado a sexta-feira)
 */
function generateEvolutionMockData(): EvolutionData[] {
  const hoje = new Date();
  const dataInicio = addCustomWeeks(hoje, -52); // 52 semanas atrás
  const dataFim = hoje;
  
  const weeks = getCustomWeeksInRange(dataInicio, dataFim);
  
  return weeks.map((week, index) => {
    // Simular crescimento com variação aleatória
    const baseGrowth = 1 + (index / weeks.length) * 0.3; // Crescimento de 30% ao longo do ano
    const randomVariation = 0.9 + Math.random() * 0.2; // Variação de ±10%
    
    const faturamento = Math.round(150000 * baseGrowth * randomVariation);
    const custos = Math.round(faturamento * (0.55 + Math.random() * 0.15)); // 55-70% do faturamento
    const lucro = faturamento - custos;
    const roi = lucro / custos;
    const roas = faturamento / (custos * 0.3); // Assumindo 30% dos custos são ADS
    
    return {
      periodo: week.weekNumber,
      semanaLabel: formatCustomWeekRangeShort(week.startDate),
      faturamento,
      custos,
      lucro,
      roi,
      roas,
      vendasA010: Math.round(40 + Math.random() * 30),
      vendasContratos: Math.round(10 + Math.random() * 15),
      leads: Math.round(200 + Math.random() * 150),
    };
  });
}

export const MOCK_EVOLUTION_DATA = generateEvolutionMockData();
