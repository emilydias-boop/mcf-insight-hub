

## Diagnostico: Edilson de Souza Freitas - Deal duplicado e Outside incorreto

### Cronologia dos eventos

```text
31/01 13:49  Deal #1 (b34d42d3) criado - PIPELINE INSIDE SALES - SDR Jessica Martins
             → Resultado: "Sem Interesse"

31/01 13:59  Deal #2 (e3565403) criado - PIPELINE INSIDE SALES - SDR Thaynar
             → 24/02 19:44: R1 agendada com Closer Thayna
             → 24/02 20:00: R1 realizada (completed)
             → 24/02 20:58: Contrato Kiwify (R$497) - VINCULADO ao attendee 3a8e3764
             → 24/02 21:06: Contrato Manual (R$497) - duplicata, NAO vinculado
             → 24/02 21:08: contract_paid_at gravado

24/02 20:58  Deal #3 (99610ea6) criado - PIPELINE INSIDE SALES - SDR Antony
             → 24/02 21:00: Reprocessado automaticamente para "Contrato Pago"
             → 25/02 14:45: R1 agendada com Closer Julio para 26/02
             → BADGE "OUTSIDE" aparecendo (imagem do usuario)
```

### Problema 1: Deal duplicado

O deal #3 (`99610ea6`) foi criado em **24/02 20:58** pelo webhook, **no mesmo minuto** que o contrato Kiwify foi processado para o deal #2. A janela de deduplicacao de 24h do webhook verifica se existe deal ativo **na mesma pipeline** criado nas ultimas 24h. O deal #2 foi criado em **31/01** (24 dias antes), entao nao foi bloqueado pela deduplicacao.

O webhook de contrato (`webhook-make-contrato`) tambem reprocessou o deal #3 e moveu para "Contrato Pago" automaticamente (activity: "Reprocessado"). Depois, no dia 25/02, alguem agendou uma R1 manualmente nesse deal com Julio.

**Resultado**: O lead tem 2 deals ativos na mesma pipeline com o mesmo email, sendo que um ja tem contrato pago.

### Problema 2: Outside incorreto

O deal #3 aparece como "Outside" no Kanban porque o hook `useOutsideDetectionForDeals` encontra:
- Email `edilsonlog@hotmail.com` tem contrato (`000 - Contrato`, Kiwify, 24/02 20:58)
- O deal #3 tem R1 agendada para 26/02
- Contrato (24/02) < R1 (26/02) → Outside = true

Tecnicamente o algoritmo esta correto para esse deal isolado. Mas o contrato pertence ao deal #2, nao ao deal #3. O outside esta aparecendo porque o sistema nao sabe que o contrato ja foi vinculado a outro deal.

### Problema 3: Contatos duplicados

Existem **8 registros de contato** para `edilsonlog@hotmail.com`. Cada webhook cria um novo contato em vez de reutilizar o existente.

### Correcoes propostas

**1. Deduplicacao de deals por contrato pago (webhook)**

Antes de criar um novo deal, verificar se ja existe um deal **com contrato pago** para o mesmo email/telefone na mesma pipeline. Se existir, bloquear a criacao.

**2. Outside detection: ignorar deals que ja tem contrato vinculado a outro deal**

No hook `useOutsideDetectionForDeals`, ao detectar um contrato, verificar se o `linked_attendee_id` da transacao aponta para um attendee de **outro** deal. Se sim, nao marcar como outside.

Logica adicional:
```text
// Pseudo-codigo
Para cada deal com email que tem contrato:
  - Buscar transacoes com linked_attendee_id
  - Se linked_attendee_id aponta para attendee de OUTRO deal → nao e outside
  - Se linked_attendee_id e null ou aponta para attendee do MESMO deal → manter logica atual
```

**3. Correcao manual imediata**

Para o caso do Edilson:
- Cancelar a R1 do deal #3 (26/02 com Julio) - nao faz sentido, lead ja comprou
- Mover deal #3 para "Sem Interesse" ou deletar
- Consolidar contatos duplicados

**4. Deduplicacao de contatos no webhook**

Reutilizar contato existente quando o email ja existe, em vez de criar um novo registro.

### Secao tecnica

Os arquivos afetados seriam:

| Arquivo | Alteracao |
|---|---|
| `webhook-lead-receiver` (edge function) | Adicionar verificacao de contrato pago existente antes de criar deal |
| `useOutsideDetectionForDeals.ts` | Checar `linked_attendee_id` para evitar false positives |
| `webhook-lead-receiver` (edge function) | Reutilizar contato existente por email |

A correcao no `useOutsideDetectionForDeals` seria a mais impactante: ao buscar contratos, tambem trazer `linked_attendee_id` e cruzar com os attendees dos deals sendo verificados. Se o contrato ja esta vinculado a um attendee de outro deal, desconsiderar.

