

## Correção: Simulação da Limpeza Completa não exibe grupos

### Problema

A simulação "Limpeza Completa" mostra 500 grupos email + 500 telefone nos contadores, mas **0 grupos no detalhe** (Todos(0), Riscos(0), 0 contatos a remover).

**Causa raiz**: A função `full_cleanup` com `dry_run=true` tenta processar 500+500 = 1000 grupos sequencialmente, cada um fazendo uma query ao banco. Isso causa:
1. **Timeout** da Edge Function (limite de ~60s do Supabase) — os logs mostram apenas processamento de telefone, sem mensagem de conclusão
2. **Payload enorme** — mesmo que completasse, 1000 grupos com detalhes de contatos excederia o limite de resposta

### Solução

Limitar o número de grupos processados na simulação para um valor viável (ex: 50 por tipo) e otimizar a lógica para evitar timeout.

**Arquivo:** `supabase/functions/merge-duplicate-contacts/index.ts`

#### Mudança 1 — Limitar grupos na simulação
No path `full_cleanup` com `dry_run=true`, processar no máximo 50 grupos de email e 50 de telefone para a simulação detalhada (suficiente para revisão), enquanto mantém os contadores totais corretos.

```
// Step 1: Email - pegar contagem total mas processar só amostra
const emailsToProcess = dryRun ? (duplicateEmails || []).slice(0, 50) : (duplicateEmails || []);

// Step 2: Phone - mesma lógica
const phonesToProcess = dryRun ? (duplicatePhones || []).slice(0, 50) : (duplicatePhones || []);
```

#### Mudança 2 — Adicionar contagem de contatos a remover nos contadores
Incluir `contacts_to_delete` no response do full_cleanup para que o modal mostre o total mesmo quando não processa todos os grupos:

```
contacts_to_delete: results.groups_processed.reduce(
  (acc, g) => acc + (g.duplicates?.length || 0), 0
)
```

#### Mudança 3 — Consolidação de deals na simulação
Na seção de deals do `full_cleanup` dry_run, popular `deal_consolidation_pairs` corretamente (já funciona no código, mas a contagem vem do Step 3 que pode não executar por timeout).

### Impacto

- A simulação abrirá rapidamente com até 100 grupos detalhados para revisão
- Os contadores totais (500 email, 500 telefone) continuam corretos
- A execução real (`dry_run=false`) continua processando todos os grupos
- O modal mostrará grupos com "Manter"/"Remover" e flags de risco

### Detalhes técnicos

| Item | Detalhe |
|------|---------|
| Arquivo | `supabase/functions/merge-duplicate-contacts/index.ts` |
| Linhas afetadas | ~90-145 (path full_cleanup) |
| Deploy | Edge Function precisa ser redeployada |

