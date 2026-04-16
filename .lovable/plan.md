

## Correção: Prevenção de duplicados por telefone/email (não apenas contact_id)

### Problema identificado

O Valdeci tem **2 contact_ids diferentes** com o mesmo telefone `15981149047`:
- `cda246e4` — o contato encontrado pela busca de telefone
- `0c6d412f` — o contato vinculado ao deal ativo (Reunião 01 Realizada)

A lógica atual busca deal existente apenas pelo `contact_id` encontrado. Mas como existem múltiplos contatos com o mesmo telefone, ela não detecta o deal do outro contact_id.

### Solução

No `DealFormDialog.tsx`, alterar o check de duplicação (linhas 172-187) para buscar deals ativos na pipeline cujo **contato tenha o mesmo email ou phone suffix**, em vez de buscar apenas pelo `contact_id` exato.

**Lógica revisada:**
1. Se tem email normalizado → buscar deals ativos na pipeline cujo contato tem esse email
2. Se tem phone suffix → buscar deals ativos na pipeline cujo contato tem esse sufixo de telefone
3. Se encontrar qualquer um → bloquear com toast

Isso usa um join ou subquery: `crm_deals` WHERE `origin_id` AND `is_duplicate = false` AND `archived_at IS NULL` AND `contact_id IN (SELECT id FROM crm_contacts WHERE phone ILIKE '%suffix%' OR email ILIKE 'email')`.

### Limpeza adicional

Também preciso deletar o deal "teste" criado agora (`9b634ef9`) para limpar o teste.

### Arquivo alterado
- `src/components/crm/DealFormDialog.tsx` — reescrever bloco de check (linhas 172-187) para buscar por email/phone no contato, não pelo contact_id

