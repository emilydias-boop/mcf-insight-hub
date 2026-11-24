# Dar nível de RH ao usuário Thobson Motta

## Situação atual
O usuário thobson.motta@minhacasafinanciada.com tem hoje os níveis **Admin** e **Closer**. Ele ainda não tem o nível **RH**.

## O que será feito
- Adicionar o nível **RH** ao usuário, sem tirar Admin nem Closer.
- Com isso, ele passa a aparecer nas regras de aprovação que pedem a assinatura do RH e pode assinar essas etapas em "Minhas aprovações".

## Observações
- Requisições que já foram enviadas mantêm os aprovadores definidos no envio. Ele só aparece como assinante de RH nas próximas requisições, a não ser que seja pedido para recalcular as existentes.
- Pode ser preciso sair e entrar de novo no sistema para o novo nível valer.

## Detalhes técnicos
- Inserir na tabela `user_roles` o registro (user_id `a15cb111-8831-4146-892a-d61ca674628a`, role `rh`), com `on conflict do nothing`.
- Não mexer em código, regras de alçada nem nos outros papéis.
