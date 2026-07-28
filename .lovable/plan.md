Problema confirmado:
- A transferência ainda falha por causa da coluna `origem_lead`: a edge function tenta gravar/ler `crm_deals.origem_lead`, mas essa coluna não existe no schema atual de `crm_deals`.
- O André também está entrando como candidato de redistribuição porque o perfil `andre.duarte@...` está ativo, com role `sdr`, squad `incorporador consorcio`, e também é closer. Então ele pode ser escolhido pelo algoritmo atual.

Plano de correção:
1. Corrigir a edge function `transfer-deals-to-bu`
   - Remover qualquer uso de `origem_lead` no select/update/insert.
   - Manter rastreabilidade por `replicated_from_deal_id`, `replicated_at`, `data_source = 'replication'`, tags e activity `bu_transfer`.

2. Travar a distribuição automática de Consórcio
   - Para destino `consorcio`, permitir somente Cleiton e Ithaline como SDRs elegíveis.
   - Excluir André e qualquer outro perfil com role/registro de closer da lista automática de Consórcio.

3. Ajustar o dropdown manual do diálogo
   - Na tela de transferência, esconder André da lista de SDR responsável quando a BU destino for Consórcio.
   - Usar a mesma regra da edge function para evitar divergência entre UI e backend.

4. Republicar e validar
   - Deploy da edge `transfer-deals-to-bu`.
   - Testar uma chamada controlada para confirmar que não retorna mais erro `origem_lead` e que o SDR atribuído em Consórcio é Cleiton ou Ithaline.