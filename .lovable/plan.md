## Adicionar canal "PLANILHA" no Funil por Canal

### Comportamento
- Novo canal **PLANILHA** aparece como linha no relatório "Funil por Canal — Fotografia da Janela" em `/bu-incorporador/relatorios` (aba Aquisição).
- Classificação: o lead é PLANILHA quando tem a tag `PLANILHA` (case-insensitive, comparação exata após normalização) **e** hoje cairia em OUTROS. Ou seja, A010 (buyer recente/esfriado), A017, ANAMNESE e ANAMNESE INCOMPLETA continuam tendo prioridade — PLANILHA só substitui OUTROS.
- Vale para todas as colunas da fotografia (Entradas, R1 Agend., R1 Realiz., No-Show, Contrato Pago, R2, Aprovados, Reprovados, Próx. Semana, Venda Final, Faturamento) e para o export Excel.

### Alterações técnicas
Arquivo: `src/hooks/useChannelFunnelReport.ts`
1. Adicionar `PLANILHA: 'PLANILHA'` no mapa `CHANNEL_LABELS`.
2. Em `classifyChannelWith30dRule`:
   - Detectar `hasPlanilhaTag = norm.some(t => t === 'PLANILHA')`.
   - No final, antes do `return 'OUTROS'`, adicionar `if (hasPlanilhaTag) return 'PLANILHA';`.
3. Incluir `'PLANILHA'` no array `FUNNEL_CHANNELS` (linha ~884) entre `ANAMNESE_INCOMPLETA` e `OUTROS`.
4. Adicionar `PLANILHA: blankDetails()` no objeto de inicialização de detalhes (linha ~956).

Arquivo: `src/components/relatorios/ChannelFunnelTable.tsx` (verificar)
- Se a tabela renderiza dinamicamente pelas chaves de `FUNNEL_CHANNELS`/labels, nenhuma mudança extra. Se houver ordem hardcoded, incluir PLANILHA antes de OUTROS.

Arquivo: `src/components/relatorios/AcquisitionReportPanel.tsx` (export Excel)
- Mesma verificação: incluir PLANILHA se a ordem estiver hardcoded.

### Validação
- Abrir `/bu-incorporador/relatorios` → Aba Aquisição → conferir nova linha PLANILHA na tabela e no Excel.
- Confirmar que A010/ANAMNESE não migraram para PLANILHA (totais por canal devem permanecer iguais, exceto OUTROS que diminui e PLANILHA aparece com o saldo).
- Validar com um deal conhecido que tem a tag Planilha no CRM (drill cell modal mostra o lead correto).
