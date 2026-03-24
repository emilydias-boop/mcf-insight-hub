

## Simulação detalhada da Limpeza Completa

### Problema
O modo `dry_run` atual só retorna contagens (ex: "150 grupos por email"). Você precisa ver **exatamente** quais contatos seriam mantidos, quais deletados, e quais deals consolidados — antes de executar.

### Solução
Criar um botão "Simulação Detalhada" que executa o `dry_run` existente (que já retorna `groups_processed` com detalhes de cada grupo) e exibe os resultados em uma tabela expansível mostrando:

- **Principal** (será mantido): nome, email, phone, deals, stage
- **Duplicados** (serão deletados): nome, email, phone, deals, stage
- Indicação visual de riscos (ex: duplicado com mais deals que o principal)

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/merge-duplicate-contacts/index.ts` | No `dry_run`, incluir mais dados em `groups_processed`: nome, email, phone de cada contato + deals com stage names. Atualmente já retorna `primary_name`, `primary_deals` e duplicates com `name`, `deals`, `max_stage_order` — adicionar `email`, `phone` e `stage_name` para visualização |
| `src/components/crm/DuplicateContactsFullCleanup.tsx` (novo ou existente) | Criar painel de resultados da simulação com tabela colapsável por grupo. Cada grupo mostra: quem é o Principal (verde), quem será deletado (vermelho), e um alerta amarelo se o duplicado tem mais reuniões/deals que o principal |

### Fluxo do usuário

1. Clica "Simular Limpeza Completa" (já existe)
2. Em vez de só um toast com números, abre um painel/modal com a lista completa
3. Cada grupo é expansível mostrando Principal vs Duplicados
4. Se algo parecer errado, o usuário pode identificar antes de executar
5. Só depois de revisar, clica "Executar Limpeza Completa"

### Flags de risco automáticos

Para cada grupo, o sistema marcará:
- **⚠️ Risco**: duplicado tem mais deals ou reuniões que o principal
- **⚠️ Risco telefone**: match por últimos 9 dígitos com emails diferentes (possível falso positivo)
- **✅ Seguro**: principal claramente tem mais dados

