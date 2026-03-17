

## Duplicar Lead de Outra Pipeline para Inside Sales (via Limbo)

### Contexto

Hoje no Limbo, quando um lead já existe em outra pipeline (ex: Consórcio), as opções são transferir (removendo da pipeline original) ou ignorar. O pedido é poder **duplicar** o deal para Inside Sales, mantendo o original intacto na pipeline de origem.

### Como funciona

Adicionar um botão/ação "Duplicar para Inside Sales" nos leads do Limbo que têm status `nao_encontrado` ou que foram encontrados em outra pipeline. A duplicação:

1. **Cria um novo deal** na pipeline Inside Sales com os dados do lead (nome, email, telefone, valor)
2. **Vincula ao mesmo contato** (`contact_id`) — sem duplicar o contato
3. **Marca como réplica** usando `replicated_from_deal_id` (campo já existente nos deals)
4. **Atribui ao SDR selecionado** com o estágio escolhido
5. **Registra atividade** no deal original e no novo

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| `src/hooks/useLimboLeads.ts` | Criar hook `useDuplicateToInsideSales` — mutation que cria deal na origin Inside Sales, vincula ao contact_id existente, e registra atividades |
| `src/pages/crm/LeadsLimbo.tsx` | Adicionar botão "Duplicar p/ Inside" nos leads que existem em outra pipeline. Ao clicar, permite selecionar SDR e estágio, e chama a mutation de duplicação |

### Lógica da mutation `useDuplicateToInsideSales`

```text
Input: { dealId (original), contactId, name, email, phone, value, ownerEmail, ownerProfileId, stageId }

1. INSERT crm_deals (name, contact_id, origin_id=INSIDE_SALES, stage_id, owner_id, owner_profile_id, replicated_from_deal_id=dealId)
2. INSERT deal_activities no deal novo (activity_type='creation', description='Duplicado da pipeline X')
3. INSERT deal_activities no deal original (activity_type='replication', description='Lead duplicado para Inside Sales')
```

### UX no Limbo

- Leads encontrados em outra pipeline mostram badge "Em outra pipeline" + botão "Duplicar p/ Inside"
- Ao clicar, usa o SDR já selecionado no filtro do Limbo e o estágio "Novo Lead" como padrão
- Suporta seleção múltipla + duplicação em massa (mesmo padrão do assign existente)

