
Problema identificado: o sistema está salvando corretamente a pipeline que você marca na tela de Configuração de BU, mas a página de Negócios do SDR do Consórcio ignora essa configuração.

O que confirmei:
- No banco, a BU `consorcio` está atualmente com apenas 1 mapeamento:
  - origin `7d7b1cb5-2a44-4552-9eff-c3b798646b78`
  - nome: `Efeito Alavanca + Clube`
  - `is_default = true`
- Ou seja: o que você selecionou foi salvo.
- O usuário Ygor está com `squad = ['consorcio']`, então a BU dele está correta.
- A origem `Efeito Alavanca + Clube` pertence ao grupo `BU - LEILÃO` com `display_name = BU - Consorcio`, então ela aparece na tela admin exatamente como no print.

Causa real do erro:
- Em `src/pages/crm/Negocios.tsx`, a lógica de SDR força sempre uma origem fixa para o Consórcio:
  - `SDR_ORIGIN_BY_BU['consorcio'] = '57013597-22f6-4969-848c-404b81dcc0cb'`
- Essa origem fixa é `PIPE LINE - INSIDE SALES`.
- Mesmo que a Configuração de BU tenha `Efeito Alavanca + Clube` como padrão, a tela de Negócios usa a origem hardcoded para SDR.
- Resultado: o admin mostra uma pipeline, mas o SDR continua preso em outra.

Implementação proposta:
1. Ajustar a prioridade na tela `src/pages/crm/Negocios.tsx`
   - Para SDR de BU multi-pipeline, usar primeiro o `selectedOriginId` ou o `selectedPipelineId` escolhido.
   - Se não houver escolha manual, usar `buMapping.defaultOrigin` quando existir.
   - Só usar `SDR_ORIGIN_BY_BU[activeBU]` como fallback final.

2. Corrigir a inicialização padrão
   - No `useEffect` que define a pipeline inicial, manter a prioridade:
     - `buMapping.defaultOrigin`
     - grupo/origem única
     - fallback SDR hardcoded
   - Garantir que, no caso do Consórcio, o padrão salvo no admin seja respeitado também para SDR.

3. Validar consistência com a sidebar
   - A sidebar já respeita `allowedOriginIds` e `allowedGroupIds`.
   - O problema não está nela; está só no cálculo de `effectiveOriginId`.
   - Vou manter a sidebar como está e alinhar apenas a regra de seleção efetiva.

4. Resultado esperado após a correção
   - Se você salvar `Efeito Alavanca + Clube` como pipeline/origem do Consórcio, o Ygor verá e carregará essa pipeline.
   - Se futuramente trocar no admin, a tela do SDR passará a seguir o novo padrão salvo.
   - O fallback hardcoded continuará existindo apenas quando não houver configuração no banco.

Detalhes técnicos
```text
Hoje:
Configuração BU salva -> bu_origin_mapping
                     -> Negocios.tsx ignora para SDR Consórcio
                     -> usa SDR_ORIGIN_BY_BU['consorcio']
                     -> abre PIPE LINE - INSIDE SALES

Após ajuste:
Configuração BU salva -> bu_origin_mapping
                     -> Negocios.tsx lê buMapping.defaultOrigin
                     -> respeita origem escolhida no admin
                     -> fallback hardcoded só se faltar configuração
```

Arquivos a alterar:
- `src/pages/crm/Negocios.tsx`

Observação importante:
- A sua configuração atual não está “errada” nem “não salvando”.
- O bug é de código: existem duas fontes de verdade concorrendo, e a regra hardcoded do SDR está ganhando da configuração do admin.
