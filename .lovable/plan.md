

## Plano: Alinhar "Aprovado" do Relatório com o Carrinho (25 → 28)

### Diagnóstico exato

Confirmei via SQL que as duas telas calculam "Aprovado" de formas diferentes:

| Tela | Universo | Regra "Aprovado" | Resultado |
|------|----------|------------------|-----------|
| **Carrinho R2** | `get_carrinho_r2_attendees` (RPC, deduped por telefone) | `r2_status_name LIKE '%aprov%'` | **28** |
| **Relatório (Realizadas → Aprovado)** | Contratos Hubla + extras da RPC | `situacao = 'realizada'` AND `r2StatusName = 'Aprovado'` | **25** |

**Por que a Relatório perde 3:** No `useContractLifecycleReport.ts`, o universo começa pelos contratos Hubla (Step 1). Para cada email Hubla, busca o R1 e cria uma "linha primária". Depois enriquece com R2 via `r2Map[deal_id]` (Step 4). 

O problema: o **deal_id da linha primária (vindo do contato Hubla)** muitas vezes é diferente do **deal_id onde o R2 foi agendado** (cross-pipeline). Exemplos confirmados no banco:
- `Rowerson` tem 2 deals (`775c95...` e `ea647...`) — Hubla pode pegar um, R2 está no outro
- `Joyce` tem 2 deals — mesma fragmentação
- `Wilde` tem 3 deals
- `Felipe Vaz` tem 2 deals

Quando o `r2Map[dealHubla]` fica vazio, a linha vira `pendente`, não `realizada`. A linha R2 correta É adicionada como "extra" (Step 1c), mas depois é eliminada pelo dedup por telefone (Step 5b, linha 666: o primeiro encontrado vence — e o Hubla veio primeiro).

Tudo isso também explica por que aparecem leads "fora da semana" no histórico anterior — eram efeitos colaterais do mesmo desalinhamento.

### Solução

Mudar o `useContractLifecycleReport.ts` para usar a **RPC unificada como fonte primária dos R2** (igual ao Carrinho), em vez de derivar R2 por `deal_id` do contrato Hubla.

#### Mudanças em `src/hooks/useContractLifecycleReport.ts`

1. **Inverter a ordem da montagem**:
   - Step A: Chamar `get_carrinho_r2_attendees` PRIMEIRO → conjunto canônico de R2s da semana (já deduped por telefone, já scoped corretamente).
   - Step B: Chamar contratos Hubla A000 paralelamente.
   - Step C: Fazer **merge por chave de telefone (9 dígitos)** — não por `deal_id`. Cada lead da semana = 1 linha, com:
     - dados de R2 vindos da RPC (status, closer, data, attendee_status)
     - dados de R1/contrato vindos da RPC (`r1_scheduled_at`, `r1_closer_name`, `r1_contract_paid_at`) — a RPC já entrega isso via JOIN
     - sale_date e refunded vindos do Hubla, casados por telefone OU email

2. **Incluir contratos Hubla "órfãos"** (com contrato mas sem R2 na semana) como linhas sintéticas, para preservar o KPI "Total Pagos" (64 no print).

3. **Remover o passo de "extras"** (Step 1c, ~linhas 336-446) — não precisa mais, pois a RPC já é a base.

4. **Remover a re-busca de R2 por `deal_id` + sibling deals** (Step 3-4, ~linhas 468-597) — a RPC já entrega o R2 correto.

5. **Manter classificação `situacao`** (`classifySituacao`) usando os dados que vêm da RPC (`attendee_status`, `r2_status_name`, `scheduled_at`).

6. **Manter dedup por telefone** como rede de segurança, mas agora será no-op porque a RPC já dedupa.

#### Resultado esperado

- "Realizadas → Aprovado" no Relatório passa a refletir os mesmos 28 leads do Carrinho
- "Total Pagos" continua mostrando contratos Hubla (sem mudança)
- Performance melhora: ~5 queries a menos
- Os contadores Realizadas/Pendentes/No-show/Reembolso ficam consistentes com o Carrinho

### Arquivos alterados

- `src/hooks/useContractLifecycleReport.ts` — refactor (mantém a interface pública / `ContractLifecycleRow`)
- Nenhuma mudança de schema, nenhuma migração SQL nova (a RPC `get_carrinho_r2_attendees` já existe e já entrega tudo o necessário)

