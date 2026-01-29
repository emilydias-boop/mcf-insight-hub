
# Correção do Webhook Make para Auto-Marcar Contrato Pago

## Problema Identificado

O webhook `webhook-make-contrato` **apenas insere** a transação na tabela `hubla_transactions`, mas **não executa** a função `autoMarkContractPaid` que:
1. Busca o attendee R1 correspondente por email/telefone
2. Marca o attendee como `contract_paid`
3. Atualiza o slot para `completed`
4. Notifica o closer para agendar R2
5. Transfere ownership do deal para o closer

Isso explica porque os contratos de Victor, Juliano e Claudia não foram marcados automaticamente.

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/webhook-make-contrato/index.ts` | **Modificar** - Adicionar lógica de auto-marcação |

---

## Solução Técnica

### 1. Adicionar a função `autoMarkContractPaid` ao webhook Make

Copiar a mesma função do `hubla-webhook-handler` para o `webhook-make-contrato`, garantindo:
- Busca de attendees R1 dos últimos 14 dias
- Match em duas fases: email primeiro, telefone como fallback
- Atualização do attendee para `contract_paid`
- Marcação do slot como `completed`
- Notificação ao closer
- Transferência de ownership do deal

### 2. Chamar `autoMarkContractPaid` após inserção

Após inserir a transação com sucesso, chamar a função passando:
- `customerEmail`: email do payload
- `customerPhone`: telefone do payload
- `customerName`: nome do payload
- `saleDate`: data da venda

---

## Fluxo Atualizado

```text
Webhook Make Contrato
├── 1. Validar payload
├── 2. Corrigir valor (se necessário)
├── 3. Inserir em hubla_transactions
├── 4. [NOVO] Executar autoMarkContractPaid()
│   ├── 4.1 Buscar attendees R1 (últimos 14 dias)
│   ├── 4.2 Match por email OU telefone
│   ├── 4.3 Atualizar attendee → contract_paid
│   ├── 4.4 Atualizar slot → completed
│   ├── 4.5 Notificar closer
│   └── 4.6 Transferir ownership do deal
└── 5. Retornar sucesso
```

---

## Detalhes Técnicos

A função `autoMarkContractPaid` será adicionada ao arquivo `webhook-make-contrato/index.ts` com a mesma lógica robusta do `hubla-webhook-handler`:

1. **Normalização de dados**: Extração dos últimos 9 dígitos do telefone para matching
2. **Busca limitada**: Apenas attendees dos últimos 14 dias com `meeting_type = 'r1'`
3. **Match em duas fases**:
   - Fase 1: Match exato por email (break imediato se encontrar)
   - Fase 2: Match por sufixo de telefone (9 últimos dígitos)
4. **Ordenação JavaScript**: Mais recente primeiro (mais confiável que ordenação aninhada do Supabase)
5. **Atualizações**:
   - `meeting_slot_attendees.status` → `contract_paid`
   - `meeting_slot_attendees.contract_paid_at` → data da reunião
   - `meeting_slots.status` → `completed`
   - `crm_deals.owner_id` → email do closer
   - `crm_deals.stage_id` → estágio "Contrato Pago"
6. **Notificação**: Criar registro em `user_notifications` para o closer

---

## Próximos Passos (Opcionais)

Após implementar a correção, posso também:
1. **Criar relatório de contratos não sincronizados**: Listar transações Make dos últimos 30 dias sem attendee correspondente
2. **Reprocessar contratos históricos**: Executar função de reprocessamento para pegar contratos antigos

