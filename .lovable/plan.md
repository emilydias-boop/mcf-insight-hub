
Objetivo: corrigir o relatório para que ANAMNESE apareça de forma confiável no campo Canal.

O que confirmei
- No banco, a Thalita de Miranda existe com:
  - contrato A000 na Hubla em 24/03
  - R1 e R2 vinculadas
  - deals no CRM no mesmo contato `ad9a9a18-...`
  - tags `[ANAMNESE]`
- Ou seja: o dado de origem existe. O problema não é falta de informação no CRM.

Causa mais provável
- A lógica atual já tenta classificar por tags, mas ainda depende de um mapeamento `email -> contato -> deal`.
- Quando o relatório não “sobe” ANAMNESE mesmo com a tag presente, o ponto frágil tende a ser:
  1. resolução do contato usado para o lead do contrato;
  2. escolha/mescla do deal desse contato;
  3. ausência de fallback explícito para origem webhook/origin_name quando a tag não vem no formato esperado;
  4. cache antigo da query mascarando a correção visual.

Plano de ajuste
1. Fortalecer a resolução do canal no hook `src/hooks/useCarrinhoAnalysisReport.ts`
- Extrair a lógica de canal para uma função mais robusta.
- Prioridade:
  - tags normalizadas
  - nome da origem (`crm_origins.name`)
  - `custom_fields->>lead_channel`
  - `data_source`
  - compra A010/Hubla como último fallback
- Tratar explicitamente padrões como:
  - `ANAMNESE`
  - `ANAMNESE-INSTA`
  - origem contendo “anamnese”
  - webhook de anamnese mesmo quando `lead_channel` vier nulo ou genérico

2. Enriquecer a query de `crm_deals`
- Incluir `origin_id`/`crm_origins(name)` junto com `tags`, `custom_fields` e `data_source`.
- Isso dá uma segunda fonte de verdade para casos em que a tag veio incompleta, foi sobrescrita ou não foi persistida do jeito esperado.

3. Melhorar a seleção/mescla de deals por contato
- Em vez de apenas acumular tags, calcular um “peso informativo” por deal.
- Se houver deal com sinal claro de ANAMNESE, ele deve prevalecer sobre deals genéricos como `csv`, `replication`, `CLIENTDATA-INSIDE`, `base clint`.
- Continuar mesclando tags, mas também preservar:
  - melhor origem
  - melhor lead_channel
  - melhor data_source para classificação

4. Aplicar a mesma robustez no fallback por telefone
- Hoje o fallback por telefone reaproveita deals, R1 e R2.
- Vou espelhar a mesma regra de classificação rica também nesse bloco, para não perder ANAMNESE quando o contato certo só é encontrado por telefone.

5. Ajustar cache/reatividade da query
- Revisar a `queryKey`/estratégia da query para evitar a sensação de que “ainda não subiu”.
- Garantir que qualquer alteração de período dispare recomputação limpa e que o valor de `canalEntrada` venha já resolvido no payload.

Resultado esperado
- Leads como Thalita passam a aparecer com `Canal = ANAMNESE`.
- Casos de webhook de anamnese deixam de cair em vazio, WEBHOOK genérico ou HUBLA (A010) quando houver evidência melhor.
- O canal fica consistente mesmo com múltiplos deals por contato.

Arquivos a alterar
- `src/hooks/useCarrinhoAnalysisReport.ts`
- possivelmente `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx` apenas se eu precisar ajustar cores/rótulos, mas a correção principal é no hook

Detalhe técnico
- Hoje a classificação usa `classifyChannel(tags, dataSource, hasA010)`.
- A correção ideal é evoluir para algo como:
```ts
classifyChannel({
  tags,
  originName,
  leadChannel,
  dataSource,
  hasA010
})
```
- Assim ANAMNESE pode ser detectada não só por tag, mas também por origem webhook/origem CRM, reduzindo falsos vazios.
