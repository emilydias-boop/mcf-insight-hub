## Diagnóstico confirmado

- O filtro da tela do SDR busca apenas leads com `owner_profile_id = user.id`.
- Hoje existem **15 leads novos** em `NOVO LEAD ( FORM )` da BU Consórcio.
- Desses 15, **0 estão com Cleiton/Ithaline em `owner_profile_id`** e **15 estão com outros responsáveis**.
- Exemplo do problema: alguns cards aparecem na sua visão com `owner_id` textual como Cleiton/Ithaline, mas o `owner_profile_id` gravado está em Bruno, Leticia, Ygor, Mayara etc. Como a tela do Cleiton filtra pelo UUID (`owner_profile_id`), eles não aparecem para ele.
- Os leads não estão mais `NULL`; o problema atual é **owner_profile_id preenchido com SDR errado**.

## Plano de correção

1. **Corrigir os leads novos já criados hoje**
   - Atualizar somente leads replicados para a origem Consórcio `Efeito Alavanca + Clube` na stage `NOVO LEAD ( FORM )` que não estão com Cleiton/Ithaline.
   - Redistribuir em round-robin entre:
     - Cleiton
     - Ithaline
   - Manter fora da alteração os leads antigos já trabalhados em outras stages.

2. **Corrigir a automação definitivamente**
   - Ajustar `process-deal-replication` para, antes de inserir o novo lead, já escolher o responsável correto quando o destino for Consórcio.
   - Inserir o lead já com:
     - `owner_id = email do SDR escolhido`
     - `owner_profile_id = UUID do SDR escolhido`
   - Não depender de atualização posterior, evitando que o registro nasça com `owner_profile_id` herdado/incorreto.

3. **Manter regra exclusiva**
   - Para essas automações de entrada no Consórcio, manter somente Cleiton + Ithaline como SDRs elegíveis.
   - Não mexer em permissões, RLS ou layout.

4. **Validar depois da correção**
   - Conferir no banco se os leads de hoje ficaram distribuídos entre Cleiton/Ithaline.
   - Conferir que não restam novos leads do Consórcio com `owner_profile_id` de SDRs de outra BU.
   - Validar que a próxima replicação gravará o owner correto desde a criação.