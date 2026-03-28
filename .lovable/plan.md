
Objetivo: fazer o campo Canal finalmente mostrar ANAMNESE de forma confiável e, se necessário, exibir a própria tag bruta no relatório.

O que confirmei
- O dado existe no banco: a Thalita de Miranda está no contato `ad9a9a18-...` com deals contendo `tags = [ANAMNESE]`.
- Então o problema não é ausência de tag no CRM; é a forma como o relatório resolve e exibe esse dado.
- No screenshot atual, vários leads seguem com `Canal = —`, então a classificação ainda está perdendo sinal antes de renderizar.

Causa mais provável
1. O hook depende de resolver corretamente `email -> contato -> deal`.
2. Quando essa resolução falha ou cai num contato/deal sem informação útil, `classifyChannel(...)` devolve vazio.
3. A UI mostra apenas `canalEntrada`; ela não tem fallback visual para as tags reais do CRM.
4. Resultado: mesmo havendo tag `[ANAMNESE]` em alguns deals, a tabela continua exibindo `—`.

Arquivos envolvidos
- `src/hooks/useCarrinhoAnalysisReport.ts`
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`

Plano de correção
1. Fortalecer a origem do canal no hook
- No `dealMap`, parar de só “mesclar tags” e passar a escolher o deal mais informativo por contato.
- Criar uma noção de prioridade:
  - ANAMNESE / ANAMNESE-INSTA / BIO-INSTAGRAM
  - A010 / HUBLA
  - LIVE / LEAD-FORM
  - WEBHOOK / CSV / BASE CLINT / genéricos
- Se o contato tiver múltiplos deals, o deal com tag mais relevante deve prevalecer no canal final.

2. Salvar também a tag/canal bruto no payload
- Além de `canalEntrada`, incluir no lead algo como:
  - `tagsOrigem: string[]`
  - `canalBruto: string | null`
- `canalBruto` pode ser a primeira tag útil encontrada (`ANAMNESE`, `A010`, etc.) ou uma concatenação curta.
- Isso resolve seu pedido de “pegar a tag e colocar aqui”.

3. Fazer fallback explícito para a própria tag na montagem do lead
- Ao montar `leads.push(...)`, aplicar a ordem:
  - `classifyChannel(...)`
  - se vazio: primeira tag útil do deal
  - se vazio: `originName`
  - se vazio: `leadChannel`
  - se vazio: `dataSource`
- Assim o relatório deixa de mostrar `—` quando já existe um marcador útil no CRM.

4. Exibir esse fallback na tabela
- Na coluna Canal, renderizar:
  - `canalEntrada` quando existir
  - senão `canalBruto`
  - senão `—`
- Opcionalmente adicionar tooltip/texto secundário com as tags completas para auditoria.

5. Ajustar exportação e filtro
- Fazer o Excel exportar o mesmo valor visível em tela.
- Garantir que o filtro “Canal” use a mesma fonte final exibida, para ANAMNESE aparecer também no dropdown.

Resultado esperado
- Leads como Thalita passam a aparecer com `Canal = ANAMNESE`.
- Mesmo quando a classificação “bonita” falhar, a tabela ainda mostra a tag/origem real em vez de `—`.
- O relatório fica auditável: dá para ver se veio de ANAMNESE, ANAMNESE-INSTA, HUBLA/A010 etc.

Detalhe técnico principal
Hoje a tabela depende só de:
```ts
canalEntrada: classifyChannel(...)
```

A correção deve virar algo no espírito de:
```ts
const canalClassificado = classifyChannel(...);
const canalBruto = getBestRawChannelFromDeal(deal);

canalEntradaFinal =
  canalClassificado ||
  canalBruto ||
  deal?.originName ||
  deal?.leadChannel ||
  deal?.dataSource ||
  null;
```

Mudança de UI
- A coluna continua se chamando “Canal”.
- Mas ela passa a exibir o valor final resolvido, mesmo que venha diretamente da tag.
- Se quiser máxima transparência, posso prever também uma coluna opcional futura “Tags CRM”.

Problema exato
Eu sei qual é o problema: o CRM tem a tag ANAMNESE, mas o relatório ainda depende demais da classificação derivada; quando a resolução do deal/canal não fecha perfeitamente, a UI não usa a tag real como fallback visual. Por isso “ainda sem aparecer”.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>
