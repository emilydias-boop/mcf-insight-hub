
## Contexto do problema
Em 16/06/26 você observou três números diferentes para A010:
- CRM: **32 leads**
- Hubla + Kiwify (somados): **41 transações**
- Relatório → Aquisição e Origem: **29**

## O que já consultei na base (snapshot)

**1. Tabela `hubla_transactions` (raw) em 16/06 (timezone BR):**
- Hubla: 34 transações, 16 e-mails distintos, 33 `completed` + 1 `refunded`
- Kiwify: 17 transações, 17 e-mails distintos, todas `completed`
- **Total raw: 51 transações / 33 e-mails únicos**

Diferença raw vs "41" provavelmente é porque você está olhando só linhas pagas em cada plataforma (talvez excluindo parcelas/duplicadas), ou olhando dois dashboards distintos.

**2. RPC `get_all_hubla_transactions` (fonte do Relatório, BU Incorporador):**
- 35 transações A010 / 33 e-mails distintos (filtro: `sale_status IN ('completed','refunded')`, `source IN (hubla, manual, make, mcfpay, kiwify)`, exclui parceria duplicada e `newsale-%`).

**3. `crm_deals` criados em 16/06 com tag A010 (origem Hubla):**
- 68 deals criados (mais que o esperado — pode estar contando leads que entraram em mais de uma pipeline via replicação, ou tags adicionadas em deals antigos).

Ou seja: os 3 números vêm de **fontes/filtragens diferentes** e nenhum dos pipelines hoje produz exatamente "32" sem mais filtros.

## Plano de diagnóstico (sem alterar código ainda)

### Passo 1 — Confirmar a origem exata de cada número
Pedir confirmação de:
- **CRM "32"**: qual tela exatamente? (Pipeline INSIDE SALES filtrado por data de criação? Aba específica? Origem Hubla?). Saber a tela permite reproduzir o filtro idêntico no SQL.
- **"41" Hubla+Kiwify**: é planilha/painel próprio das plataformas, ou nosso dashboard? Soma de "compradores únicos" ou linhas?
- **"29" no Relatório**: tela `/bu-incorporador/relatorios` → painel **Aquisição e Origem** → linha A010 do bloco "Por Origem" ou "Por Canal"? Ou linha A010 do funil de canais?

### Passo 2 — Reconciliar via SQL controlado
Para cada origem confirmada no passo 1, rodar uma query única no banco com o mesmo filtro do código, gerar planilha CSV com:
- `hubla_id`, `source`, `customer_email`, `customer_phone`, `sale_status`, `sale_date`, `product_name`, `linked_attendee_id`, `deal_id` correspondente em `crm_deals`.
- Comparar lista por lista (CRM vs Relatório vs Hubla/Kiwify) e marcar quais e-mails sumiram em qual etapa.

### Passo 3 — Identificar a causa raiz provável (hipóteses)
Com base no que vi:
- **Relatório < CRM (29 < 32):** o RPC `get_all_hubla_transactions` filtra `source IN (hubla, kiwify, manual, make, mcfpay)` **e** exige `INNER JOIN product_configurations` com `target_bu='incorporador'`. Qualquer compra A010 com `product_name` que não esteja cadastrado em `product_configurations` (ou com target_bu diferente) cai fora do relatório, mas continua no CRM.
- **CRM < Hubla+Kiwify (32 < 41):** a regra atual de deduplicação (`check_duplicate_deal_by_identity` por email + sufixo de 9 dígitos do telefone) une compras do mesmo cliente em um único deal, então 41 compras viram 32 leads únicos. Pode ainda haver leads bloqueados por `automation_blacklist` ou por regra de partner/renewal.
- **Hubla+Kiwify "41":** pode ser a soma de "vendas pagas" exibidas nas próprias plataformas, que conta cada compra/parcela; nosso banco já tem `completed`+`refunded` separados.

### Passo 4 — Entregáveis ao final do diagnóstico
- Planilha `discrepancia-a010-2026-06-16.csv` em `/mnt/documents/` com os 3 conjuntos lado a lado.
- Um doc curto em `docs/qa/2026-06-17-discrepancia-a010-16-06.md` com causa raiz e recomendação (ex.: cadastrar produto faltante em `product_configurations`, ou ajustar filtro do RPC, ou excluir refunded da contagem do relatório).

### Passo 5 — Correções (só após validar causa)
Dependendo do achado:
- Cadastrar produto faltante em `product_configurations` (sem migração de schema).
- Ajustar `get_all_hubla_transactions` para refletir a regra correta de contagem.
- Adicionar coluna "Origem" no painel mostrando explicitamente quantos foram excluídos e por qual motivo (transparência).

## Perguntas que preciso de você antes de prosseguir
1. Confirma a tela exata onde leu **32** no CRM? (pipeline + filtro de data)
2. O **41** veio dos painéis nativos da Hubla e Kiwify, ou de algum relatório nosso?
3. O **29** é da seção "Por Origem", "Por Canal" ou do funil de canais dentro de `/bu-incorporador/relatorios → Aquisição e Origem`?

Com essas respostas eu rodo o passo 2 e te entrego a planilha de reconciliação + diagnóstico.
