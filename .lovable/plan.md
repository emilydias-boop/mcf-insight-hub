# Ligar o envio do Relatório da Cota ao HARVEY

## O que será feito
1. Guardar com segurança o endereço do HARVEY (`https://nwqukdfcvlrmwwhlghqp.supabase.co/functions/v1/mcf-relatorio-cota`) e a chave que você enviou. Nenhum dos dois fica no código.
2. Fazer um envio de teste com uma única cota, escolhida por você ou a primeira que tiver CPF, e conferir a resposta do HARVEY.
3. Mostrar o resultado: enviado ou o erro que o HARVEY devolveu.

## O que não muda
- O formato dos dados e a regra de envio continuam iguais: só administradores enviam, e cada cota tem um registro por mês.
- Nada é apagado nem recalculado.

## Detalhes técnicos
- Segredos `HARVEY_WEBHOOK_URL` e `HARVEY_WEBHOOK_SECRET`, que a função `harvey-relatorio-cota` já lê.
- O teste chama a função como administrador e confere o registro em `consorcio_harvey_envios`.
- Recomendação: como a chave foi enviada pelo chat, troque-a depois nos dois lados.
