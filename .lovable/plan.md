

## Plano: Corrigir colunas Parceria, SDR e Closer na tabela de Contatos

### Problemas identificados

1. **Parceria não aparece** — A coluna usa `hidden 2xl:table-cell` (só visível em telas ≥1536px). Na maioria dos monitores fica escondida.

2. **SDR mostrando "—"** — O hook só busca `original_sdr_email` do deal, mas muitos deals não têm esse campo preenchido. Deveria fazer fallback para `owner_id` (email do dono do deal, que geralmente é o SDR).

3. **Closer mostrando "—"** — O hook só busca `r1_closer_email`, que só é preenchido após agendamento de R1. Muitos deals novos não têm closer ainda, o que é esperado. Porém o fallback poderia buscar via `meeting_slot_attendees` se existir reunião agendada.

4. **Organização "—"** — O campo `organization_name` é genuinamente nulo para a maioria dos contatos no banco. Isso é dado real, não bug.

### Alterações

**`src/hooks/useContactsEnriched.ts`**
- Adicionar `owner_id` ao select dos `crm_deals`
- No SDR: usar `original_sdr_email || owner_id` como fallback (owner geralmente é o SDR)
- Resolver nome do owner_id no mesmo profileMap

**`src/pages/crm/Contatos.tsx`**
- Remover `hidden 2xl:table-cell` da coluna Parceria — torná-la visível em `lg:` ou sempre visível
- Manter a coluna mesmo quando `partnerMap` é undefined (mostrar "—" enquanto carrega)
- Reorganizar colunas para priorizar as mais úteis: Nome, Email, Telefone, Status, Etapa, SDR, Closer, Parceria (Organização pode ficar em `2xl:`)

### Resultado
- Parceria sempre visível na tabela
- SDR preenchido para a maioria dos deals (via fallback owner_id)
- Closer continua "—" quando não há reunião, o que é correto

