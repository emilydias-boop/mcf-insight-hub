

## Popup de Encaixe com Seleção de Semana + Remoção do Encaixe

### Problema

Hoje, em todos os 3 locais onde o botão "Encaixar" existe (Carrinho → Acumulados, Carrinho → Próxima Safra, Relatório → Pendentes/Próxima Safra), o clique é **imediato e cego** — o lead é jogado na **semana atualmente exibida** na tela, sem o usuário confirmar qual semana. E não há como **reverter** o encaixe (sair de uma semana e voltar para acumulados/próxima safra) — só alterando dados manualmente.

### O que vamos entregar

**1. Novo componente `EncaixarSemanaDialog`** (reutilizável)

Popup unificado usado por todos os botões Encaixar do sistema. Mostra:

```
┌─ Encaixar no Carrinho ────────────────────────────┐
│ Lead: João Silva                                   │
│ Contrato pago: 15/04  •  R2 em: 21/04 (próx safra)│
│                                                    │
│ Selecione a semana do carrinho:                    │
│                                                    │
│  ○ Semana anterior  (Qui 03/04 → Qua 09/04)       │
│  ● Semana atual     (Qui 10/04 → Qua 16/04) ← dica│
│  ○ Próxima semana   (Qui 17/04 → Qua 23/04)       │
│  ○ Semana seguinte  (Qui 24/04 → Qua 30/04)       │
│                                                    │
│ ⚠️ Encaixado atualmente em: Qui 10/04 — Qua 16/04  │
│    [ Remover encaixe (voltar p/ próxima safra) ]   │
│                                                    │
│          [ Cancelar ]    [ Confirmar Encaixe ]     │
└────────────────────────────────────────────────────┘
```

- **4 opções de semana**: anterior, atual (padrão, destacada), próxima, +2 — ancoradas na semana exibida no painel onde o usuário clicou
- **Dica inteligente**: sugere a semana atual por padrão; se o contrato foi pago em outra safra, destaca a safra natural do contrato como "recomendada"
- **Seção "Remover encaixe"** (visível só se `carrinho_week_start` já estiver preenchido): limpa o override e devolve o lead para o bucket natural (acumulados ou próxima safra)
- **Texto informativo** do que vai acontecer: "O lead aparecerá na aba Aprovados da semana X"
- Estados: loading (durante mutation), sucesso (toast + fecha), erro (toast + mantém aberto)

**2. Nova mutation `useDesencaixarDoCarrinho`** (em `src/hooks/useEncaixarNoCarrinho.ts`)

```ts
// Seta carrinho_week_start = NULL e mantém r2_status_id atual
// Invalida as mesmas queries que useEncaixarNoCarrinho
```

**3. Integração nos 3 pontos existentes**

| Local | Mudança |
|---|---|
| `R2AccumulatedList.tsx` (Carrinho → Acumulados) | Trocar chamada direta `onEncaixar(lead)` por abrir `EncaixarSemanaDialog` com `weekStart` inicial = semana exibida |
| `R2AprovadosList.tsx` (Carrinho → Próxima Safra) | Trocar `handleEncaixar` direto por abrir o diálogo |
| `R2ContractLifecyclePanel.tsx` (Agenda R2 → Relatório → Pendentes → Próxima Safra) | Mesma troca |

Cada ponto passa `attendeeId`, `attendeeName`, `currentCarrinhoWeekStart` (se houver) e `suggestedWeek` para o diálogo. O diálogo cuida de tudo: seleção, mutation (`useEncaixarNoCarrinho` ou `useDesencaixarDoCarrinho`), invalidação, toast.

**4. Exibição do encaixe atual**

O `CarrinhoLeadRow` já tem `carrinho_week_start`. O diálogo lê esse campo para:
- Mostrar em qual semana o lead está atualmente encaixado (se estiver)
- Habilitar o botão "Remover encaixe"
- Evitar ruído: se tentar encaixar na mesma semana onde já está, botão fica desabilitado com texto "Já está nesta semana"

**5. Adicionar `futureR2AttendeeId`/`carrinhoWeekStart` onde faltar**

`R2ContractLifecyclePanel` já expõe `row.futureR2AttendeeId` e `row.carrinhoWeekStart` (já confirmado). `R2AccumulatedList` precisa do `meeting_id`/`id` do attendee (já tem). `R2AprovadosList` usa `att.id` e o novo campo `att.carrinho_week_start` — esse campo precisa ser **exposto** em `R2CarrinhoAttendee` (`useR2CarrinhoData.ts` → mapper `toAttendee`), hoje está apenas na linha bruta (`CarrinhoLeadRow`).

### Como funciona a reversão ("tirar da semana")

- **No Carrinho R2**, quando o usuário está na aba "Aprovados" e o lead tem `carrinho_week_start = semana_atual` **E** `dentro_corte = false` (ou seja, é um aprovado da próxima safra que foi encaixado manualmente), mostrar o botão **Encaixar** com variante "alternar" — o diálogo abre já com a seção "Remover encaixe" em destaque.
- **Na aba "Acumulados"**, a lista só mostra leads **não encaixados** (`carrinho_week_start IS NULL`), então a reversão não aparece lá — o usuário vê o lead reaparecer quando desencaixar de outro lugar.
- **No Relatório**, idem: se o lead já tem `carrinhoWeekStart` preenchido, o diálogo destaca a opção de remover.

### Diagrama de fluxo

```text
[Clicar "Encaixar"]
        │
        ▼
[EncaixarSemanaDialog abre]
        │
        ├─ Já encaixado? ──► mostra semana atual + botão "Remover"
        │                         │
        │                         ▼
        │                   [useDesencaixarDoCarrinho] → fecha + toast
        │
        ├─ Selecionar semana ────► [useEncaixarNoCarrinho(weekStart)]
        │                                │
        │                                ▼
        │                          invalida queries → fecha + toast
        │
        └─ [Cancelar] ──► fecha sem ação
```

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/crm/EncaixarSemanaDialog.tsx` | **NOVO** — diálogo reutilizável |
| `src/hooks/useEncaixarNoCarrinho.ts` | + export `useDesencaixarDoCarrinho` |
| `src/hooks/useR2CarrinhoData.ts` | + `carrinho_week_start` no `R2CarrinhoAttendee` e no mapper `toAttendee` |
| `src/components/crm/R2AccumulatedList.tsx` | Substituir callback direto por abertura do diálogo |
| `src/components/crm/R2AprovadosList.tsx` | Substituir `handleEncaixar` direto por abertura do diálogo |
| `src/components/crm/R2ContractLifecyclePanel.tsx` | Substituir `handleEncaixar` direto por abertura do diálogo |
| `src/pages/crm/R2Carrinho.tsx` | Remover a mutation inline de `handleEncaixarAccumulated` (passa a ser dentro do diálogo); manter apenas `handleScheduleAccumulated` |

### Validação

1. Carrinho → Próxima Safra → clicar Encaixar em um lead → abre diálogo com 4 semanas → confirmar "próxima semana" → lead some da aba, aparece na aba Aprovados da próxima semana (navegando)
2. Carrinho → Aprovados → achar o lead encaixado → clicar Encaixar → diálogo mostra "Encaixado em X/X" + botão Remover → clicar Remover → lead volta para Próxima Safra da safra original
3. Carrinho → Acumulados → clicar Encaixar → escolher semana atual → lead some de Acumulados, aparece em Aprovados
4. Agenda R2 → Relatório → KPI Pendentes → filho Próxima Safra → linha com botão Encaixar → abre o **mesmo** diálogo → encaixar reflete imediatamente no Carrinho R2 (react-query invalida)
5. Tentar encaixar 2x na mesma semana: segunda vez botão aparece desabilitado "Já está nesta semana"
6. Toast de sucesso em cada caso; toast de erro se RPC falhar

### Escopo

- 1 arquivo novo, 6 arquivos editados
- Zero migrations
- Zero mudança de RLS ou métricas
- Reutiliza 100% das queries e mutations já existentes (só adiciona `useDesencaixarDoCarrinho`)
- Totalmente bidirecional e coeso: qualquer alteração em qualquer tela propaga via React Query

