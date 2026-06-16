# A010 — fechar Hubla 290 vs CRM 243

## Diagnóstico atualizado

A diferença não fecha só adicionando tag em deals existentes.

Na Hubla, considerando apenas vendas **completed** de A010 em 01/06–15/06:

| Situação no CRM | Qtde |
|---|---:|
| Já visíveis no Pipeline com A010 no período | **252** |
| Têm deal no PIPELINE INSIDE SALES, mas fora do filtro/sem atualização correta | **6** |
| Têm contato/deal em outro pipeline, mas não em Inside Sales | **18** |
| Sem deal/contato correspondente suficiente no CRM | **17** |

O número da tela aparece **243** porque o filtro atual depende de `created_at` ou `updated_at` do deal no período; parte dos compradores já existia antes, e parte nunca entrou no PIPELINE INSIDE SALES.

## Plano de correção

### 1. Webhook A010 daqui pra frente
No `hubla-webhook-handler/index.ts`, reforçar a regra de A010:

- A010 é restrito ao `PIPELINE INSIDE SALES`.
- Quando chegar venda A010 completed:
  - localizar/criar contato por e-mail ou telefone;
  - procurar deal do contato no PIPELINE INSIDE SALES;
  - se existir, garantir tag `A010`, tag `Hubla`, `custom_fields.a010_compra = true`, `a010_data = sale_date`, e atualizar `updated_at`;
  - se não existir deal em PIS, criar um novo deal no PIPELINE INSIDE SALES com tags `A010`, `Hubla`, `Jun/26`, preservando dados básicos da compra;
  - não mover automaticamente deals de outros pipelines; criar o deal PIS separado para respeitar a regra “A010 buyers are restricted strictly to PIPELINE INSIDE SALES”.

### 2. Backfill para Junho
Executar uma migration/backfill idempotente para os 290 compradores A010 completed:

- Para os **6** com deal em PIS: atualizar tag/data/custom_fields para aparecer no filtro.
- Para os **18** que só estão em outro pipeline: criar deal novo em PIS com tag A010/Hubla/Jun/26, sem apagar nem mover o deal antigo.
- Para os **17** sem deal/contato: criar contato quando necessário e criar deal novo em PIS.
- Evitar duplicidade usando match por `lower(email)` e últimos 9 dígitos do telefone.

### 3. Verificação
Depois do backfill:

- Recontar compradores A010 completed na Hubla: esperado **290**.
- Recontar deals visíveis em `/crm/negocios` com tag A010 + período 01/06–15/06: esperado ficar próximo de **290**.
- Listar qualquer exceção restante com motivo: reembolso, e-mail duplicado, telefone divergente, duplicidade já existente ou ausência de stage padrão.

## Fora de escopo

- Alterar regra visual do filtro de data da tela.
- Mover/deletar deals antigos de outros pipelines.
- Incluir vendas refunded/canceladas no número de A010.
