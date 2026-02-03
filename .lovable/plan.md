
# Plano: Importar/Vincular Contatos do Cleiton

## Situação Atual

| Métrica | Valor |
|---------|-------|
| Total de deals do Cleiton | 371 |
| Deals sem contact_id | 269 |
| Contatos na lista enviada | 195 |

### Exemplo de Match
O contato **Tiago Raifran** já existe em `crm_contacts`:
- ID: `648cc57d-0c49-4eb3-a2af-1b547dd0d035`
- Email: `tiagoraifran@gmail.com`
- Telefone: `63992368338`

Mas os deals dele estão com `contact_id = NULL`. Precisamos vincular!

---

## Solução: Edge Function para Importação Inteligente

Criar uma nova edge function `bulk-update-contacts` que:

1. **Recebe a lista** de contatos (id, name, email, phone)
2. **Processa cada contato**:
   - Se o contato já existe em `crm_contacts` (por email ou telefone): Atualiza dados faltantes
   - Se não existe: Cria novo contato
3. **Vincula aos deals**:
   - Busca deals por nome (match flexível com ILIKE)
   - Atualiza `contact_id` nos deals encontrados

---

## Fluxo de Processamento

```text
Lista de Contatos (195)
         |
         v
   +-----------+
   | Para cada |
   | contato   |
   +-----------+
         |
         v
   +----------------+      Sim     +------------------+
   | Existe em      |------------->| Atualizar email/ |
   | crm_contacts?  |              | phone faltante   |
   | (email/phone)  |              +------------------+
   +----------------+                      |
         | Não                             |
         v                                 |
   +----------------+                      |
   | Criar novo     |                      |
   | contato        |                      |
   +----------------+                      |
         |                                 |
         v<--------------------------------+
   +------------------+
   | Buscar deals por |
   | nome (ILIKE)     |
   +------------------+
         |
         v
   +------------------+
   | Atualizar        |
   | contact_id       |
   +------------------+
```

---

## Arquivos a Criar/Modificar

### 1. Nova Edge Function: `supabase/functions/bulk-update-contacts/index.ts`

Funcionalidades:
- Receber array de contatos via POST
- Processar em chunks para evitar timeout
- Retornar estatísticas detalhadas

### 2. Atualizar `supabase/config.toml`

Adicionar configuração da nova função.

---

## Detalhes Técnicos

### Estrutura do Request

```json
{
  "contacts": [
    {
      "clint_id": "9d71bfc8-57fb-47bc-a715-1cdf7aab0482",
      "name": "Adailton lima Borges",
      "email": "adailtoneng123@gmail.com",
      "phone": "+55 93981000567"
    }
  ],
  "owner_id": "cleiton.lima@minhacasafinanciada.com"
}
```

### Lógica de Match para Contatos

```typescript
// 1. Buscar por email
let contact = await supabase
  .from('crm_contacts')
  .select('id')
  .eq('email', email.toLowerCase())
  .maybeSingle();

// 2. Se não encontrou, buscar por telefone normalizado
if (!contact.data) {
  contact = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('phone', normalizedPhone)
    .maybeSingle();
}

// 3. Se não encontrou, criar novo
if (!contact.data) {
  const { data: newContact } = await supabase
    .from('crm_contacts')
    .insert({ clint_id, name, email, phone })
    .select('id')
    .single();
  contactId = newContact.id;
} else {
  contactId = contact.data.id;
}
```

### Lógica de Vinculação aos Deals

```typescript
// Atualizar deals do owner que batem com o nome
await supabase
  .from('crm_deals')
  .update({ contact_id: contactId })
  .eq('owner_id', ownerId)
  .ilike('name', `%${name}%`)
  .is('contact_id', null);
```

---

## Estatísticas Esperadas

Após execução:

| Ação | Quantidade Estimada |
|------|---------------------|
| Contatos criados | ~150 (novos) |
| Contatos atualizados | ~45 (já existiam) |
| Deals vinculados | ~180 (match por nome) |
| Deals ainda sem contato | ~89 (nomes diferentes) |

---

## Tratamento de Duplicados na Lista

A lista contém duplicados (ex: "Hamilton Veloso Souto" e "Marcelo silva" aparecem 2x). A função vai:
1. Processar apenas a primeira ocorrência
2. Pular duplicados usando Set de emails processados

---

## Próximos Passos Após Implementação

1. Executar a importação dos 195 contatos do Cleiton
2. Verificar quantos deals foram vinculados
3. Para os deals restantes sem contato, verificar se os nomes diferem
4. Repetir processo com listas dos outros owners
