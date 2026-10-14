# Liberar PIPELINE CRÉDITO IMOBILIÁRIO para Karen Nazario

## O que achei
- Karen (karen.nazario@minhacasafinanciada.com) tem os cargos SDR e Gerente de Relacionamento. No cadastro de SDR o squad dela é só `pos_venda`, e ela não tem nenhuma pipeline liberada individualmente.
- A pipeline CRÉDITO IMOBILIÁRIO tem 16 etapas, de Parceiros 50k a Perdido. Nenhuma delas tem bloqueio para os cargos dela, e etapa sem regra aparece por padrão.
- Ou seja, a pipeline não aparece porque não está liberada para ela. As etapas não são o problema.

## O que vou fazer (só para a Karen)
1. Guardar um backup do cadastro de SDR dela, que só admin consegue ler.
2. Liberar individualmente para ela as pipelines abaixo. Essa liberação substitui o padrão da área, então a pipeline do Pós Venda entra junto para ela não perder o que já vê:
   - a pipeline do Pós Venda, que ela já usa
   - PIPELINE CRÉDITO IMOBILIÁRIO
3. Não mudo cargo, squad, regras de etapa nem nada de outros colaboradores.
4. Conferir depois:
   - a liberação gravada no banco;
   - que as 16 etapas aparecem para os cargos dela;
   - se ela vê todos os clientes da pipeline ou só os que estão com ela. Se for só os dela, eu te aviso antes de mexer.

## Detalhes técnicos
- `sdr.allowed_origin_ids` = [POS_VENDA_ORIGIN_ID, 'c4ed1700-0000-4000-8000-000000000002'] em `sdr.id = 86880ed1-4bf1-4ea2-8fc5-e5ff673bf139`, com backup da linha antes.
- Não precisa mudar código. `stage_permissions` não tem linhas para essas etapas e `canViewStage` libera por padrão.
