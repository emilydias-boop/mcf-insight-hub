

## Corrigir dados vazios nos Cadastros Pendentes

### Problema

Os 2 registros foram criados na tabela `consorcio_pending_registrations` pela migration, mas apenas com os campos minimos (`proposal_id`, `deal_id`, `tipo_pessoa`, `status`, `created_by`). Os dados do cliente (nome, telefone, email, vendedor, data aceite) ficaram vazios porque a migration nao os incluiu.

### Solucao

Executar UPDATE nos 2 registros existentes, preenchendo os dados a partir do contato (`crm_contacts`) e do deal (`crm_deals`) associados:

**Registro 1 - Joao Ferreira dos Santos:**
- `nome_completo`: "Joao Ferreira dos Santos"
- `telefone`: "85 98894-6554"
- `email`: "ferreiramsf@gmail.com"
- `vendedor_name`: "Joao Pedro Martins Vieira"
- `aceite_date`: "2026-02-23"

**Registro 2 - Kleber Donizetti Teixeira:**
- `nome_completo`: "Kleber Donizetti Teixeira"
- `telefone`: "12982341050"
- `email`: "kleber.teixeira@icloud.com"
- `vendedor_name`: "Joao Pedro Martins Vieira"
- `aceite_date`: "2026-02-23"

### Alteracao adicional no codigo

Modificar o hook `usePendingRegistrations` (`src/hooks/useConsorcioPendingRegistrations.ts`) no trecho da query de listagem para, quando `nome_completo` estiver vazio, fazer fallback para o nome do contato do deal associado. Isso evita que cadastros futuros criados sem dados do cliente fiquem completamente em branco na lista.

### Detalhes tecnicos

- Usar o insert tool do Supabase para executar os 2 UPDATEs (dados existentes, nao e schema)
- Modificar a query do `usePendingRegistrations` para fazer LEFT JOIN com `crm_deals` e `crm_contacts` como fallback

