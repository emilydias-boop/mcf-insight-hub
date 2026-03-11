

## Melhorias no Relatório de Qualificação R2

O relatório atual mostra dados na tabela mas sem filtros por coluna, sem edição inline, sem histórico do lead, e sem exportação/cópia granular. Vou adicionar tudo isso.

### Mudanças

**1. `src/hooks/useR2QualificationReport.ts` — Adicionar `dealId` ao retorno**
- Incluir `dealId` e `contactId` no `R2QualificationReportRow` para permitir edição inline e abrir histórico
- Já temos o deal disponível na query, só precisa expor no mapeamento

**2. `src/components/crm/R2QualificationReportPanel.tsx` — Reformular tabela**

- **Filtros por coluna**: Adicionar filtros dropdown acima da tabela para Estado, Renda, Profissão, Já Constrói, Terreno, Imóvel, Tempo MCF (todos os campos de qualificação). Filtros client-side sobre os dados já carregados
- **Edição inline na tabela**: Cada célula de qualificação (estado, renda, profissao, etc.) vira um Select/Input editável ao clicar. Usa `useUpdateDealCustomFields` para salvar (mesmo hook do drawer). Mostrar valor como texto, ao clicar abre o select inline
- **Histórico do lead**: Botão de "ver histórico" em cada linha que abre um Dialog/Drawer com a timeline do lead (reutilizar `useLeadFullTimeline`)
- **Exportar Excel**: Já existe, manter e garantir que respeita os filtros de coluna aplicados
- **Copiar leads**: Botão "Copiar" que copia os leads filtrados (nome + telefone + email) para clipboard em formato tabular

**3. Novo componente: `src/components/crm/R2ReportLeadHistoryDialog.tsx`**
- Dialog que recebe `dealId` e `contactId`
- Renderiza timeline usando `useLeadFullTimeline`
- Mostra eventos (ligações, reuniões, notas, mudanças de estágio)

### Fluxo
1. Usuário abre aba Relatório → vê filtros gerais (período, closer, status) + filtros por campo de qualificação
2. Clica em uma célula de qualificação → edita inline → salva automaticamente
3. Clica no ícone de histórico → abre dialog com timeline completa do lead
4. Clica "Exportar Excel" → exporta dados filtrados
5. Clica "Copiar" → copia dados filtrados para clipboard

### Detalhes técnicos
- Filtros de coluna: `useMemo` com `.filter()` encadeados sobre `data`
- Edição inline: componente `EditableCell` que alterna entre texto e Select/Input
- Usa as mesmas opções do `R2QualificationTab` (ESTADO_OPTIONS, RENDA_OPTIONS, etc.)
- `useUpdateDealCustomFields` já invalida `r2-meetings-extended`; adicionar invalidação de `r2-qualification-report` no `onSuccess`

