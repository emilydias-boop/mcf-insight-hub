

## Problema: Leads transferidos continuam aparecendo no Limbo

O Limbo carrega um **snapshot estático** dos resultados da comparação (salvo em `limbo_uploads.comparison_results`). Quando você transfere leads (atribui dono), o status muda **só na memória**. Na próxima vez que abre a página, ele carrega o snapshot antigo -- que ainda mostra "Não Encontrado" ou "Sem Dono" para leads que já foram atribuídos.

Além disso, leads como "Mirian Cristina Signori" aparecem como "Não Encontrado" porque a busca local só verifica deals da pipeline Inside Sales. Se o deal dela está em outra pipeline ou foi criado depois da comparação, não é detectado.

### Solução: Revalidar resultados contra dados atuais ao carregar

**1. Revalidar ao carregar resultados persistidos** (`LeadsLimbo.tsx`)

Quando a página carrega os resultados salvos do Supabase, em vez de exibir o snapshot estático, cruzar novamente os emails/nomes dos resultados contra os `localDeals` atuais para atualizar o status de cada lead:

- Se um lead estava "nao_encontrado" mas agora existe um deal com aquele email/nome e tem dono → marcar como "com_dono"
- Se um lead estava "sem_dono" mas o deal agora tem `owner_id` → atualizar para "com_dono"
- Persistir automaticamente o resultado revalidado no Supabase

Isso é um `useEffect` adicional que roda quando `localDeals` carrega E `results` já foram carregados do snapshot.

**2. Ampliar busca local** (`useLimboLeads.ts`)

A query `useInsideSalesDeals` filtra por `origin_id = INSIDE_SALES_ORIGIN_ID`. Leads transferidos ou criados em outras pipelines não aparecem. Adicionar uma segunda checagem por email/telefone no `crm_contacts` para detectar se o contato existe no sistema (com qualquer pipeline), marcando como "com_dono" se tiver deal vinculado.

Alternativa mais simples: na revalidação, buscar `crm_contacts` por email dos "nao_encontrado" e verificar se têm deals associados.

**3. Salvar revalidação automaticamente**

Após revalidar, chamar `updateLimboResults` para persistir os novos status, evitando que a próxima carga precise revalidar de novo.

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/crm/LeadsLimbo.tsx` — adicionar useEffect de revalidação ao carregar |
| Editar | `src/hooks/useLimboLeads.ts` — adicionar função `revalidateResults` que cruza resultados com deals atuais + busca contatos por email |

### Resultado esperado

- Leads transferidos desaparecem dos filtros "Sem Dono" e "Não Encontrado" automaticamente
- A revalidação ocorre toda vez que a página abre com dados persistidos
- Sem necessidade de re-upload da planilha

