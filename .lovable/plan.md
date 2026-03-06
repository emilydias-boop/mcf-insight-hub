
## Diagnóstico: Por que aparecem 7 e não 9 contratos no dia 05/03/2026

### O que o banco de dados mostra

Há **9 registros `contract_paid` com `contract_paid_at` em 05/03 (UTC)**:

| Lead | Closer | CP (BRT) | Motivo desconto |
|---|---|---|---|
| Anilton Gomes Sales | Mateus Macedo | **04/03 21:29 BRT** | ⚠️ Cai em 04/03 no horário de Brasília |
| Gabi | Cristiane Gomes | 05/03 11:35 | ✅ Conta |
| Edson Vander | Cristiane Gomes | 05/03 12:58 | ✅ Conta |
| Marcos Araujo | Julio | 05/03 13:30 | ✅ Conta |
| Lucas Totini | Julio | 05/03 14:52 | ✅ Conta |
| **Marcos Araujo** | **Thayna** | **05/03 14:54** | ⚠️ `booked_by` = Thaynar Tavares (role_type = `closer`, não SDR) |
| Matheus Soares | Thayna | 05/03 15:10 | ✅ Conta |
| Mariane Souza | Mateus Macedo | 05/03 15:50 | ✅ Conta |
| Rafa | Mateus Macedo | 05/03 19:52 | ✅ Conta |

Além disso, **RSC e Thiago Fernando Alves** tiveram reunião em 05/03 mas `contract_paid_at` foi registrado em **06/03** — então entram na contagem de 06/03.

### As 2 causas do "7 em vez de 9"

**Causa 1 — Marcos Araujo (Thayna): descartado pelo filtro de SDR**
O `booked_by` desse lead aponta para `thaynar.tavares@minhacasafinanciada.com`, que está cadastrado na tabela `sdr` com `role_type = 'closer'`. O hook `useR1CloserMetrics` só conta contratos cujo `booked_by` tenha `role_type = 'sdr'`, então esse contrato é ignorado. **A Thaynar Tavares é uma closer que às vezes agenda diretamente, e o role_type dela está errado na tabela `sdr`.**

**Causa 2 — Anilton Gomes Sales: vai para 04/03 no horário de Brasília**
O `contract_paid_at` é `2026-03-05 00:29 UTC` = `2026-03-04 21:29 BRT`. O sistema filtra por UTC (sem converter para BRT), então Anilton cai no dia 04/03 quando filtrado pela data 05/03 em horário local.

### O que contar como "9 contratos de 05/03"?

Os **9 contratos reais** do dia 05/03 em BRT são:
- Gabi, Edson Vander, Marcos Araujo (Julio), Lucas Totini, Marcos Araujo (Thayna), Matheus Soares, Mariane Souza, Rafa = **8 por contract_paid_at em BRT**  
- Anilton = **1 que caiu em 05/03 BRT mas está em 05/03 UTC (00:29)**  
→ Total = 9 ✅

Mais RSC e Thiago Fernando = **2 "follow-ups" pagos em 06/03** (reunião foi em 05/03, pagamento foi no dia seguinte).

### Plano de correção

**Correção 1 — Role type da Thaynar Tavares na tabela `sdr`**
A `thaynar.tavares@minhacasafinanciada.com` está com `role_type = 'closer'` na tabela `sdr`. Isso faz o sistema descartar contratos que ela agendou. Corrigir para `role_type = 'sdr'` (ou adicionar uma regra que aceite `role_type = 'closer'` também quando o `booked_by` estiver na lista de profissionais ativos da BU).

O fix correto é **na query do `useR1CloserMetrics`**: aceitar `booked_by` que sejam closers ativos da BU além de SDRs, porque closers também podem agendar reuniões diretamente.

**Correção 2 — Conversão de fuso horário na contagem de contratos**
O filtro de `contract_paid_at` usa timestamps UTC diretamente. Quando o usuário seleciona "05/03", o sistema filtra `>= 2026-03-05T00:00:00` e `<= 2026-03-05T23:59:59` UTC — isso exclui o Anilton (00:29 UTC = 21:29 BRT do dia 04/03) e inclui contratos que na prática ocorreram em 06/03 BRT.

A correção é converter o `contract_paid_at` para BRT antes de filtrar, usando `AT TIME ZONE 'America/Sao_Paulo'` nas queries ou ajustando o range de datas para compensar os 3 horas (subtrair 3h no start, somar 21h no end).

### Arquivos a alterar

1. **`src/hooks/useR1CloserMetrics.ts`** (linhas ~60-275): Expandir o filtro `validSdrEmails` para incluir também closers ativos da BU como `booked_by` válidos (ou remover o filtro por `role_type = 'sdr'` e aceitar qualquer profissional ativo).

2. **`src/hooks/useR1CloserMetrics.ts`** (linhas ~202-224): Ajustar o range de datas do `contract_paid_at` para compensar o fuso horário de Brasília (UTC-3), usando `startOfDay - 3h` e `endOfDay + 21h`, ou filtrando por `contract_paid_at AT TIME ZONE 'America/Sao_Paulo'`.

3. **`src/hooks/useContractReport.ts`** (linhas ~44-96): Mesma correção de fuso — o relatório de contratos também filtra por UTC, causando a mesma discrepância para usuários que consultam por data BRT.

### Resumo visual do diagnóstico

```text
Contratos reais em 05/03 BRT = 9
  ├── Contados pelo sistema = 7
  ├── Faltando #1: Marcos Araujo (Thayna)
  │     └── Causa: booked_by = thaynar.tavares (role_type=closer, não conta como SDR)
  └── Faltando #2: Anilton Gomes Sales
        └── Causa: contract_paid_at 00:29 UTC = 21:29 BRT do dia 04/03
              └── Sistema filtra por UTC, não BRT
```
