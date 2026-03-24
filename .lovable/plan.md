

## Correção: Backfill com dedup por telefone e proteção de estágio

### Problema
O backfill cria deals duplicados porque:
1. Só deduplica por email exato (não detecta `v.b.romaoo@gmail.com` vs `v.b.romao@gmail.com`)
2. Não verifica telefone para encontrar contatos existentes
3. Não protege leads em estágios avançados (ex: "Contrato Pago")

### Solução
Adicionar 3 camadas de proteção no `backfill-a010-missing-deals`:

### Mudanças

| Arquivo | O que fazer |
|---------|-------------|
| `supabase/functions/backfill-a010-missing-deals/index.ts` | Ver abaixo |

#### Detalhes da lógica corrigida:

1. **Dedup por telefone na busca de contatos** (passo 5): Além de buscar por email, buscar contatos por sufixo de telefone (últimos 9 dígitos). Se encontrar contato por telefone que já tem deal no PIS, marcar email como "já tem deal".

2. **Verificação de deals por email (não só contact_id)**: Antes de criar deal, buscar `crm_deals` via JOIN com `crm_contacts` onde o email do contato bate, independente de qual `contact_id` está no deal. Isso cobre o caso de múltiplos contatos com mesmo email.

3. **Proteção de estágio avançado**: Se o contato já tem deal no PIS em estágio posterior a "Novo Lead" (ex: Contrato Pago), pular. Adicionar stat `skipped_advanced_stage`.

4. **Antes de rodar**: Limpar os 2 deals duplicados do Victor Romão criados pelo backfill anterior (IDs `fca41234` e `853c566b`) e os contatos órfãos.

### Fluxo corrigido

```text
Para cada email A010:
  1. Buscar contato por email OU por telefone (9 dígitos)
  2. Se encontrou contato → verificar se tem deal no PIS
  3. Se tem deal no PIS → SKIP (já existe)
  4. Se é parceiro → SKIP
  5. Se não tem deal → criar contato (se necessário) + deal
```

### Passo prévio: Limpeza
- Deletar os 2 deals backfill duplicados do Victor Romão
- Deletar os 2 contatos criados pelo backfill que são duplicatas (`36ba5171` e `f5c45d8e`)
- Verificar se há outros casos similares nos 12 deals criados pelo backfill anterior

