
Motivo do duplicado: hoje o sistema está tratando essas duas linhas como vendas diferentes, não como a mesma venda.

O que encontrei no caso do Samuel:
- Existe 1 transação `mcfpay` com:
  - `product_name = "A001 - Incorporador Completo"`
  - `source = "mcfpay"`
- Existem transações `make` com:
  - `product_name = "Parceria"`
  - `source = "make"`

Por isso ainda aparece 2x.

Por que a deduplicação não pegou:
1. A RPC deduplica por:
   - `LOWER(customer_email)`
   - `product_name`
   - `installment_number`
2. Como os nomes dos produtos são diferentes:
   - `"A001 - Incorporador Completo"`
   - `"Parceria"`
   eles caem em grupos diferentes e ambas sobrevivem.
3. O `webhook-make-parceria` só tenta marcar o registro do Make como “secundário” quando encontra uma venda `source = 'hubla'`.
   - Ele não verifica `mcfpay`
4. A tela `/bu-incorporador/transacoes` usa `useTransactionsByBU`, mas não filtra `count_in_dashboard = false`, então mesmo que o Make fosse marcado como não contar, ele ainda poderia aparecer dependendo da RPC.

Resumo simples:
```text
MCFPAY: produto real = "A001 - Incorporador Completo"
MAKE:   produto genérico = "Parceria"

Dedup atual compara nome exato do produto.
Como os nomes não batem, o sistema entende que são duas vendas diferentes.
```

Plano de correção:
1. Ajustar `webhook-make-parceria`
   - ao procurar duplicata, verificar também `source in ('hubla', 'mcfpay', 'kiwify')`
   - não apenas `source = 'hubla'`
2. Melhorar o matching do Make
   - quando chegar `tipo_parceria = "Parceria"`, tentar identificar o produto real equivalente pelo valor/data/email
   - ou ao menos usar uma chave de deduplicação mais inteligente no backend
3. Atualizar as RPCs de transações
   - considerar `count_in_dashboard`
   - e/ou deduplicar por uma chave mais estável que o `product_name` literal
   - por exemplo: email + data próxima + valor + parcela
4. Corrigir dados já gravados
   - localizar registros `make` duplicados do `mcfpay`
   - marcar como não exibíveis ou excluí-los da deduplicação final
5. Validar especificamente o caso do Samuel
   - deve sobrar só a venda prioritária `mcfpay`
   - o `make` só deve aparecer se não existir `hubla`, `kiwify` ou `mcfpay`

Detalhe técnico principal:
- O bug não está mais no filtro de fonte
- O bug agora está na chave de deduplicação, porque o `make` usa produto genérico `"Parceria"` enquanto o `mcfpay` usa o nome real do produto

Implementação recomendada:
- Curto prazo: excluir `make` quando existir `mcfpay/hubla/kiwify` para o mesmo email + mesma data + mesma parcela + valor próximo
- Médio prazo: padronizar o `product_name` salvo pelo `webhook-make-parceria`, para não gravar `"Parceria"` quando já for possível inferir o produto real

Se você aprovar, a correção que eu seguiria é:
1. ajustar o `webhook-make-parceria` para deduplicar contra `mcfpay`
2. atualizar as RPCs para esconder `make` quando houver fonte prioritária equivalente
3. corrigir os registros antigos já duplicados

Se quiser, posso preparar esse patch agora.

Se implementar isso, também recomendo:
<lov-actions>
<lov-suggestion message="Teste isso end-to-end buscando novamente o lead Samuel Barbosa de Souza na tela de transações para confirmar que só sobra a venda prioritária.">Verifique que funciona</lov-suggestion>
<lov-suggestion message="Implemente a correção para que vendas do Make sejam ocultadas quando já existir a mesma venda em hubla, kiwify ou mcfpay, usando deduplicação por email + data + parcela + valor aproximado.">Corrigir duplicidade Make</lov-suggestion>
<lov-suggestion message="Padronize o webhook-make-parceria para tentar inferir e salvar o nome real do produto em vez de usar apenas 'Parceria'.">Padronizar nome do produto</lov-suggestion>
</lov-actions>
