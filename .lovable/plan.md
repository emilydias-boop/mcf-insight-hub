

## Problema: Consolidação não funciona quando contatos ainda estão separados

### Causa raiz

Os dois deals do Lucas Ângelo pertencem a **contatos diferentes** no banco:
- `ef4eb45f` — "Lucas Ângelo" (phone: "62 9220-6062")
- `c8d83183` — "Lucas Ângelo Magalhães Botelho Vitorino" (phone: "62992206062")

A consolidação de deals agrupa por `(contact_id, origin_id)`. Como os `contact_id` são diferentes, ela nunca os encontra como par duplicado.

A solução é: **primeiro unificar os contatos duplicados por telefone**, depois a consolidação de deals funciona automaticamente.

### O que precisa acontecer

O fluxo correto é: **Merge de contatos → Consolidação de deals**. Ambos os passos já existem no código, mas precisam ser executados na ordem certa.

### Correção: Criar um fluxo combinado "Limpar Duplicados"

Adicionar um modo `full_cleanup` na Edge Function que executa os dois passos em sequência:
1. Merge de contatos duplicados (por email + por telefone)
2. Consolidação de deals na mesma origin

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/merge-duplicate-contacts/index.ts` | Adicionar modo `full_cleanup` que executa merge por email, merge por telefone e consolidação de deals em sequência |
| `src/pages/crm/ContatosDuplicados.tsx` | Adicionar botão "Limpeza Completa" que executa o fluxo combinado |
| `src/hooks/useDuplicateContacts.ts` | Adicionar hook `useFullCleanup` |

### Detalhes técnicos

No modo `full_cleanup`:
```text
1. Executar processEmailGroup() para todos os emails duplicados
2. Executar processPhoneGroup() para todos os telefones duplicados
3. Executar consolidateDeals() para todos os pares (contact, origin) com 2+ deals
4. Retornar totais combinados
```

O botão na UI terá opção de dry_run (simular) e execução real, mostrando:
- X contatos unificados por email
- X contatos unificados por telefone  
- X deals consolidados na mesma pipeline

### Resultado esperado

Ao executar "Limpeza Completa":
- Os contatos "Lucas Ângelo" e "Lucas Ângelo Magalhães Botelho Vitorino" serão unificados (match por telefone sufixo `992206062`)
- Os 2 deals na mesma origin serão consolidados em 1 (mantendo "Reunião 02 Realizada" por ter stage_order=11 > 9)
- Histórico transferido para o deal mantido

