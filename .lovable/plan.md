
# Diagnóstico do corte do Carrinho R2

## O que já foi aplicado
- Em `src/lib/carrinhoWeekBoundaries.ts`, o fim de `r2Meetings` foi trocado para `friCartCutoff`.
- Com isso, as abas que usam `boundaries.r2Meetings` (`useR2CarrinhoData`, `useR2CarrinhoKPIs`, `useR2ForaDoCarrinhoData`) passaram a respeitar o corte no **fim** da janela.
- A aba de `aprovados` já usava corte no fim via `boundaries.aprovados`.

## Por que ainda não está funcionando
1. **Só o fim foi corrigido; o início não.**  
   Hoje o início continua em `friAfterPrevCart` = sexta `00:00`.  
   Então o sistema ainda **não “puxa” para a próxima semana** o que foi feito **após o corte da sexta anterior**.

2. **A semana seguinte não lê o corte da sexta anterior.**  
   `getCarrinhoMetricBoundaries(...)` recebe só a `config` da semana atual e usa:
   ```ts
   config?.carrinhos?.[0]?.horario_corte
   ```
   Ou seja: se você ajustou o corte “da outra sexta”, essa informação **não entra** no cálculo da semana seguinte.

3. **As queries não reagem automaticamente à mudança de config.**  
   Os hooks do carrinho usam `queryKey` sem incluir o corte/config:
   - `useR2CarrinhoData`
   - `useR2CarrinhoKPIs`
   - `useR2ForaDoCarrinhoData`
   - `useR2CarrinhoVendas`
   
   E `saveConfig` invalida só:
   ```ts
   ['carrinho-config', weekKey]
   ```
   então a tela pode continuar com dados antigos até refresh manual/troca de semana.

4. **Há risco de fuso horário no corte.**  
   O corte é montado com `Date.UTC(...)`. Se a regra do negócio é “12h horário local”, pode existir deslocamento no instante real aplicado.

## Conclusão objetiva
O sistema hoje respeita o corte **para fechar a semana atual**, mas **não usa esse corte para abrir a semana seguinte**.  
Por isso, leads feitos **após 12h da sexta anterior** não entram onde você espera.

## Plano de correção
1. **Separar corte de abertura e corte de fechamento**
   - `previousFridayCutoff` = sexta anterior no horário de corte da semana anterior
   - `currentFridayCutoff` = sexta atual no horário de corte da semana atual

2. **Mudar a janela operacional**
   - `r2Meetings.start` deve virar `previousFridayCutoff`
   - `r2Meetings.end` deve virar `currentFridayCutoff`
   - mesmo ajuste para `aprovados` quando a regra precisar ser contínua entre semanas

3. **Ler também a config da semana anterior**
   - `R2Carrinho.tsx` precisa carregar:
     - config da semana aberta
     - config da semana anterior
   - e passar ambas para o cálculo das boundaries

4. **Fazer os dados atualizarem ao salvar corte**
   - incluir dados relevantes da config no `queryKey`, ou
   - invalidar no `onSuccess` do save:
     - `r2-carrinho-data`
     - `r2-carrinho-kpis`
     - `r2-fora-carrinho-data`
     - `r2-carrinho-vendas`
     - `r2-accumulated-leads`

5. **Revisar fuso**
   - confirmar se 12:00 é regra local
   - se for, ajustar a criação das datas para não aplicar o corte em UTC “puro”

## Arquivos envolvidos
- `src/lib/carrinhoWeekBoundaries.ts`
- `src/hooks/useCarrinhoConfig.ts`
- `src/pages/crm/R2Carrinho.tsx`
- `src/hooks/useR2CarrinhoData.ts`
- `src/hooks/useR2CarrinhoKPIs.ts`
- `src/hooks/useR2ForaDoCarrinhoData.ts`
- `src/hooks/useR2CarrinhoVendas.ts`
- possivelmente `src/hooks/useR2AccumulatedLeads.ts` se os acumulados também precisarem seguir o mesmo corte

## Detalhes técnicos
```text
Hoje:
  semana N   = sexta 00:00 -> sexta corte
  semana N+1 = sexta 00:00 -> sexta corte

Esperado:
  semana N   = sexta anterior no corte -> sexta atual no corte
  semana N+1 = sexta atual no corte    -> próxima sexta no corte
```

## Validação depois da correção
- salvar corte 12:00 na sexta de origem
- conferir um lead criado antes de 12:00 e outro depois de 12:00
- validar que:
  - antes de 12:00 fica na semana original
  - depois de 12:00 aparece na semana seguinte
  - KPIs e abas mostram a mesma regra
  - salvar a config reflete sem precisar trocar de semana
