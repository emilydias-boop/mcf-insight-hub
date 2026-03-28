

## Fix: Leads com contato duplicado no CRM aparecem como "Sem contato"

### Causa raiz

O caso do Juan Felipe ilustra um problema sistêmico: existem **contatos duplicados no CRM** — um com email (sem deals) e outro sem email mas com deals e reuniões. O hook busca contatos **apenas por email**, encontra o contato errado (sem deals), e classifica como "Cadastro incompleto" ou "Sem contato no CRM".

Dados reais:
- Contato `ebb6d3f3` — telefone `+5511994477764`, email NULL → **tem deals e reuniões**
- Contato `22d08ad8` — telefone `11994477764`, email `jcfalonso@hotmail.com` → **sem deals**
- Transação Hubla: email `jcfalonso@hotmail.com`, telefone `+5511994477764`

O hook encontra o contato #2 por email, vê que não tem deals, e marca como gap operacional.

### Solução

**Arquivo: `src/hooks/useCarrinhoAnalysisReport.ts`**

1. **Busca de contatos por email E por telefone** — Na query de `crm_contacts` (linha 161), adicionar uma segunda query em paralelo buscando contatos pelo sufixo de 9 dígitos do telefone (normalizado). Usar os phones extraídos das transações.

2. **Merge de contatos** — Ao construir o `contactMap`, priorizar o contato que tem deals. Após a query de deals, verificar se o contato encontrado por email tem deal; se não, tentar o contato encontrado por telefone.

3. **Lógica de merge no contactMap**:
   - Buscar contatos por email (atual)
   - Buscar contatos por telefone (novo) — normalizar para 9 últimos dígitos
   - Para cada transação, se o contato por email não tem deal mas o contato por telefone tem, usar o por telefone

**Implementação concreta**:

```text
Queries paralelas (já existem 5, adicionar 1):
  - crm_contacts por email (existente)
  - crm_contacts por phone (NOVO) — buscar todos contatos, depois filtrar em JS pelo sufixo de 9 dígitos

Após a query de deals:
  - Para cada email sem deal no dealMap, verificar se existe contato alternativo por phone com deal
  - Se sim, substituir o contactId no contactMap
```

4. **Busca de contatos por phone**: Extrair sufixos de 9 dígitos dos phones das transações, buscar contatos com `phone` LIKE esses sufixos. Isso é complexo via Supabase — alternativa mais prática: buscar todos os `contact_id` que têm deals e reuniões, e cruzar por phone no JS.

**Abordagem simplificada** (mais eficiente):
- Após ter o `contactMap` por email e o `dealMap`, identificar emails cujo contactId não tem deal
- Para esses, buscar na tabela `crm_contacts` por phone (normalizado 9 dígitos) usando uma query adicional
- Se encontrar contato com deal, substituir no contactMap

### Resultado esperado
- Juan Felipe (e outros leads com contatos duplicados) aparece corretamente com SDR, R1, R2
- Redução de falsos "Sem contato no CRM" e "Cadastro incompleto"

