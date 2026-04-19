
## Proposta: marcar parcelas já pagas no momento do cadastro retroativo

Excelente ideia — é a solução **certa pela raiz**. Em vez de só "não cancelar", o sistema vai refletir a realidade: cota antiga já entra com as parcelas passadas marcadas como `pago`.

### Como funciona hoje
No cadastro, o formulário pede `parcelas_pagas_empresa` (quantas a empresa já pagou pelo cliente). Quando salva, gera 240 parcelas todas `pendente` — só as da empresa ficam marcadas certo. Resultado: 13 meses de parcelas vencidas e "não pagas" → cota cancela sozinha.

### Como vai funcionar
No `CreateConsorcioCardModal`, quando a `data_contratacao` for anterior ao mês atual, exibir um **novo passo / seção** para o usuário informar o histórico de pagamentos retroativos:

**Campo principal:** "Parcelas já pagas pelo cliente até hoje" (número)
- Default sugerido = nº de meses entre `data_contratacao` e hoje menos `parcelas_pagas_empresa`
- Usuário pode ajustar (cliente atrasou alguns meses, etc.)

**Campo opcional:** "Data do último pagamento" (date)
- Permite o sistema saber até onde marcar como pago

### Lógica de geração das parcelas (na criação)

Ao criar a cota com data retroativa:

1. Gera 240 parcelas normalmente (com datas, valores, comissões — toda lógica atual preservada)
2. Marca as **N primeiras parcelas do tipo `cliente`** como `status='pago'` com `data_pagamento` = data de vencimento (ou `ultimo_pagamento` se informado)
3. Marca as **M primeiras parcelas do tipo `empresa`** como `status='pago'` (já existe — `parcelas_pagas_empresa`)
4. Parcelas restantes ficam `pendente` normalmente

### Onde mexer

**1. `src/types/consorcio.ts`** — adicionar em `CreateConsorcioCardInput`:
```ts
parcelas_pagas_cliente?: number;
data_ultimo_pagamento_cliente?: string;
```

**2. `CreateConsorcioCardModal` (ou wizard equivalente)** — novo bloco condicional:
- Aparece apenas se `data_contratacao < startOfMonth(hoje)`
- Mostra: "Cadastro retroativo detectado — informe o histórico"
- Campo numérico com sugestão automática
- Campo data opcional

**3. Hook de criação (`useCreateConsorcioCard` ou edge function de geração de parcelas)** — após gerar parcelas, executar update marcando as N primeiras parcelas do cliente como pagas, espelhando lógica já existente para empresa.

**4. Remover o auto-cancelamento** em `ConsorcioCardDrawer.tsx` (linhas 110-115) — vira ação manual via dropdown. Mesmo com retroativo correto, evita cancelar acidentalmente cotas legítimas.

**5. `deveSerCancelado` / `verificarRiscoCancelamento`** — mantêm lógica atual (sem necessidade de filtrar por `created_at`), porque agora as parcelas pagas estarão refletidas corretamente.

### Cotas já canceladas indevidamente
Posso, em paralelo, listar as cotas canceladas pelo bug anterior (status=`cancelado`, criação recente, contratação antiga, 0 parcelas pagas) para o usuário revisar e reativar manualmente — sem alterações em massa sem aprovação.

### Garantias
- Toda a lógica de cálculo de parcelas, comissões e valores **permanece intacta**
- Cadastros novos (sem retroativo) funcionam exatamente como hoje
- Cobrança e KPIs passam a refletir realidade
- Auto-cancelamento removido → nunca mais cancela sozinho ao abrir drawer
