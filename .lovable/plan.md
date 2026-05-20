## Objetivo

Adicionar no dialog "Exportar Negócios" um seletor de **Canal**, alinhado à mesma taxonomia usada no resto do CRM (badge do kanban + funil de canais). Em vez de um único "BIO", separar Anamnese em **Completa** e **Incompleta** — assim dá pra exportar, por exemplo, "só A010 em Reunião 01 Agendada" ou "só Anamnese Completa em Contrato Pago".

## Como vai funcionar

Nova seção **Canais** no topo do dialog, com 4 checkboxes:

- **A010** — comprador A010 (via `channelMap` existente)
- **Anamnese Completa** — tag exata `ANAMNESE` no deal
- **Anamnese Incompleta** — tag exata `ANAMNESE-INCOMPLETA` no deal
- **Outros** — nenhum dos acima (live, sem tag, etc.)

Por padrão todos vêm marcados (preserva o comportamento atual). O contador do rodapé e o export passam a aplicar **estágios** AND **canais** AND a lista de **campos**.

```text
┌─ Exportar Negócios ──────────────────────────────────┐
│ Canais                              Desmarcar todos  │
│ ☑ A010                                               │
│ ☑ Anamnese Completa                                  │
│ ☑ Anamnese Incompleta                                │
│ ☑ Outros                                             │
│ ──────────────────────────────────────────────────── │
│ Estágios                            Desmarcar todos  │
│ ☑ Reunião 01 Agendada  ☑ Contrato Pago  ...          │
│ ──────────────────────────────────────────────────── │
│ Campos                              Desmarcar todos  │
│ ...                                                  │
│                                                      │
│ 1.234 negócios selecionados              [Exportar]  │
└──────────────────────────────────────────────────────┘
```

## Detalhes técnicos

**1. `src/pages/crm/Negocios.tsx`**
- Passar o `channelMap` (já existente, `Map<dealId, 'a010' | 'bio' | 'live'>`) para `<ExportDealsDialog channelMap={channelMap} />`.

**2. `src/components/crm/ExportDealsDialog.tsx`**
- Nova prop opcional `channelMap?: Map<string, 'a010' | 'bio' | 'live'>`.
- Novo tipo local `ExportChannel = 'A010' | 'ANAMNESE_COMPLETA' | 'ANAMNESE_INCOMPLETA' | 'OUTROS'`.
- Função `getDealChannel(deal)`:
  1. Se `channelMap.get(deal.id) === 'a010'` → `A010`.
  2. Senão, normaliza `deal.tags` (suportando string e objetos `{name}` em JSON, como já é feito em `channelClassifier.ts`):
     - tag exata `ANAMNESE-INCOMPLETA` → `ANAMNESE_INCOMPLETA`.
     - tag exata `ANAMNESE` → `ANAMNESE_COMPLETA`.
  3. Caso contrário → `OUTROS`.
- Novo estado `selectedChannels: Set<ExportChannel>` inicializado com os 4 valores.
- Nova seção "Canais" no `ScrollArea`, antes de "Estágios", com toggle individual + "Marcar/Desmarcar todos".
- `filteredDeals` passa a aplicar também `selectedChannels.has(getDealChannel(d))`.
- Botão "Exportar" desabilitado também quando `selectedChannels.size === 0`.
- Nenhuma mudança nos campos exportados, no nome do arquivo nem no formato.

## Fora do escopo
- Não muda a lógica de classificação global (`channelClassifier`, `classifyChannelWith30dRule`, funil de canais).
- Não muda outros dialogs/relatórios de exportação.
- Não adiciona "Anamnese-Insta" como canal separado (segue caindo em "Outros") — posso incluir como 5º checkbox se você quiser.