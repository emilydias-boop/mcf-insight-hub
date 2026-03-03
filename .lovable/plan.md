

## Problema

O "Painel do Diretor" mostra apenas os períodos atuais (semana atual, mês atual, ano atual). O usuário quer navegar para outros meses/semanas e ver todos os dados atualizados.

## Solução

Adicionar um seletor de mês/ano no header do dashboard, que controla os períodos de referência usados pelo hook `useSetoresDashboard`.

### 1. Modificar `useSetoresDashboard` para aceitar data de referência

Atualmente o hook usa `new Date()` como referência fixa. A mudança:
- Aceitar parâmetro `referenceDate: Date` 
- Todos os cálculos de período (semana, mês, ano) serão baseados nessa data em vez de `today`
- Labels se adaptam automaticamente (ex: "Mês Fevereiro", "Semana 21/02 - 27/02")

### 2. Adicionar controle de navegação no `Dashboard.tsx`

No header, ao lado do título, adicionar:
- Seletor de mês/ano com botões `<` e `>` para navegar entre meses
- Botão "Hoje" para voltar ao período atual
- O mês selecionado determina a `referenceDate` passada ao hook

Layout:
```text
Painel do Diretor                    [<] Março 2026 [>] [Hoje]
Visão consolidada de metas...
```

### 3. Arquivos a modificar

- **`src/hooks/useSetoresDashboard.ts`**: Adicionar parâmetro `referenceDate?: Date`, usar como base em vez de `new Date()`
- **`src/pages/Dashboard.tsx`**: Adicionar `useState` para mês/ano selecionado, renderizar controles de navegação, passar `referenceDate` ao hook

### Comportamento
- Default: mês atual (igual a hoje)
- Navegar para meses anteriores mostra a semana que contém o último dia daquele mês
- "Ano" continua sendo o ano da data de referência
- Metas (targets) continuam usando os mesmos valores fixos da `team_targets`

