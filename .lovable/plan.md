

# Separar Pagamentos Consórcio por Cliente vs Empresa + Acesso rápido ao código de barras

## Resumo
Adicionar abas "Cliente" e "Empresa" na tela de Pagamentos Consórcio para separar as parcelas por tipo. Na aba "Empresa", incluir acesso rápido ao código de barras (copiar com 1 clique) e botão para abrir o boleto PDF + marcar como pago de forma mais ágil.

## O que muda para o usuário

1. **Duas abas na página**: "Cliente" (parcelas tipo `cliente`) e "Empresa" (parcelas tipo `empresa`) — cada uma com seus próprios KPIs e filtros
2. **Coluna "Código de Barras" na aba Empresa**: mostra a linha digitável truncada com botão de copiar (1 clique copia para a área de transferência)
3. **Ações rápidas na aba Empresa**: botão de abrir boleto PDF + botão de marcar como pago lado a lado, sem precisar abrir drawer
4. A aba "Cliente" mantém o comportamento atual (WhatsApp, envio em massa, etc.)

## Detalhes técnicos

### 1. Página `Pagamentos.tsx` — Adicionar Tabs
Envolver o `ConsorcioPagamentosTab` em `Tabs` com duas abas: "Cliente" e "Empresa". Cada aba passa um filtro `tipoFilter` ao componente.

### 2. `ConsorcioPagamentosTab.tsx` — Receber prop `tipoFilter`
Nova prop `tipoFilter: 'cliente' | 'empresa'` que é passada ao hook para filtrar os dados.

### 3. `useConsorcioPagamentos.ts` — Filtro por tipo
Adicionar `tipoFilter` aos filtros. Aplicar filtro no `processedData` pelo campo `tipo` do installment.

### 4. `PagamentosTable.tsx` — Variante Empresa
Quando `tipoFilter === 'empresa'`:
- Adicionar coluna "Cód. Barras" que mostra a `linha_digitavel` do boleto com botão de copiar (ícone clipboard)
- O `boletoMap` já carrega os dados; basta incluir `linha_digitavel` no mapeamento
- Botões de ação (abrir PDF + marcar pago) ficam mais proeminentes e lado a lado

### 5. `useBoletosByInstallments` — Incluir `linha_digitavel`
O hook já retorna `*` (todos os campos), então `linha_digitavel` já está disponível. Basta atualizar o `boletoMap` no `PagamentosTable` para incluir esse campo.

### Fluxo esperado (Empresa)
1. Financeiro abre aba "Empresa"
2. Vê a lista de parcelas pendentes com código de barras visível
3. Clica no ícone de copiar → linha digitável copiada
4. Cola no app do banco e paga
5. Volta e clica no check verde para marcar como pago

