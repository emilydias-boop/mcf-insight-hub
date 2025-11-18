import { format } from "date-fns";

export interface ExportData {
  kpis: any[];
  funis: any[];
  semanas: any[];
  periodo: { inicio: Date; fim: Date; tipo: 'semana' | 'mes' };
  canal: string;
}

export function exportDashboardData(data: ExportData) {
  const { kpis, funis, semanas, periodo, canal } = data;
  
  // Criar CSV
  let csvContent = "data:text/csv;charset=utf-8,";
  
  // Cabeçalho do relatório
  csvContent += `Dashboard MCF - Relatório Exportado\n`;
  csvContent += `Período:,${format(periodo.inicio, "dd/MM/yyyy")} - ${format(periodo.fim, "dd/MM/yyyy")}\n`;
  csvContent += `Tipo:,${periodo.tipo === 'mes' ? 'Mensal' : 'Semanal'}\n`;
  csvContent += `Canal:,${canal === 'todos' ? 'Todos os canais' : canal}\n`;
  csvContent += `Data de Exportação:,${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
  
  // KPIs
  csvContent += `\n=== INDICADORES PRINCIPAIS (KPIs) ===\n`;
  csvContent += `Indicador,Valor,Variação\n`;
  kpis.forEach(kpi => {
    const change = kpi.change !== undefined ? `${kpi.change > 0 ? '+' : ''}${kpi.change.toFixed(1)}%` : '-';
    csvContent += `${kpi.title},${kpi.value},${change}\n`;
  });
  
  // Funis
  csvContent += `\n=== FUNIS DE CONVERSÃO ===\n`;
  funis.forEach(funil => {
    csvContent += `\n${funil.titulo}\n`;
    csvContent += `Etapa,Leads,Meta,Taxa de Conversão\n`;
    funil.etapas.forEach((etapa: any) => {
      csvContent += `${etapa.nome},${etapa.valor},${etapa.meta},${etapa.taxa}\n`;
    });
  });
  
  // Tabela Semanal/Mensal
  csvContent += `\n=== RESUMO FINANCEIRO (${periodo.tipo === 'mes' ? 'MENSAL' : 'SEMANAL'}) ===\n`;
  csvContent += `Data Início,Data Fim,Faturamento A010,Vendas A010,Valor OB Evento,Vendas OB Evento,Faturamento Contrato,Vendas Contratos,Faturamento OB Construir,Vendas OB Construir,Faturamento OB Vitalício,Vendas OB Vitalício\n`;
  
  semanas.forEach((semana: any) => {
    csvContent += `${semana.dataInicio},${semana.dataFim},`;
    csvContent += `R$ ${semana.faturamentoA010.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
    csvContent += `${semana.vendasA010},`;
    csvContent += `R$ ${semana.valorVendidoOBEvento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
    csvContent += `${semana.vendasOBEvento},`;
    csvContent += `R$ ${semana.faturamentoContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
    csvContent += `${semana.vendasContratos},`;
    csvContent += `R$ ${semana.faturamentoOBConstruir.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
    csvContent += `${semana.vendasOBConstruir},`;
    csvContent += `R$ ${semana.faturamentoOBVitalicio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
    csvContent += `${semana.vendasOBVitalicio}\n`;
  });
  
  // Calcular totais
  const totais = semanas.reduce((acc: any, semana: any) => ({
    faturamentoA010: acc.faturamentoA010 + semana.faturamentoA010,
    vendasA010: acc.vendasA010 + semana.vendasA010,
    valorVendidoOBEvento: acc.valorVendidoOBEvento + semana.valorVendidoOBEvento,
    vendasOBEvento: acc.vendasOBEvento + semana.vendasOBEvento,
    faturamentoContrato: acc.faturamentoContrato + semana.faturamentoContrato,
    vendasContratos: acc.vendasContratos + semana.vendasContratos,
    faturamentoOBConstruir: acc.faturamentoOBConstruir + semana.faturamentoOBConstruir,
    vendasOBConstruir: acc.vendasOBConstruir + semana.vendasOBConstruir,
    faturamentoOBVitalicio: acc.faturamentoOBVitalicio + semana.faturamentoOBVitalicio,
    vendasOBVitalicio: acc.vendasOBVitalicio + semana.vendasOBVitalicio,
  }), {
    faturamentoA010: 0,
    vendasA010: 0,
    valorVendidoOBEvento: 0,
    vendasOBEvento: 0,
    faturamentoContrato: 0,
    vendasContratos: 0,
    faturamentoOBConstruir: 0,
    vendasOBConstruir: 0,
    faturamentoOBVitalicio: 0,
    vendasOBVitalicio: 0,
  });
  
  csvContent += `TOTAL,,`;
  csvContent += `R$ ${totais.faturamentoA010.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
  csvContent += `${totais.vendasA010},`;
  csvContent += `R$ ${totais.valorVendidoOBEvento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
  csvContent += `${totais.vendasOBEvento},`;
  csvContent += `R$ ${totais.faturamentoContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
  csvContent += `${totais.vendasContratos},`;
  csvContent += `R$ ${totais.faturamentoOBConstruir.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
  csvContent += `${totais.vendasOBConstruir},`;
  csvContent += `R$ ${totais.faturamentoOBVitalicio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},`;
  csvContent += `${totais.vendasOBVitalicio}\n`;
  
  // Criar link de download
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `dashboard-mcf-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
