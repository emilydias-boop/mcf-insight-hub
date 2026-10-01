# Gerente de contas no Financeiro À Receber

## O que o payload já mostra (verificado no banco)

- Os encaminhamentos do app externo trazem o bloco `gerente` com **id, nome, email e telefone**, já gravado em `gerente_nome`/`gerente_email`.
- Filas recebidas até hoje: **Consórcio 36** (36 com gerente) e **MCF Solar 29** (28 com gerente). **Incorporador: nenhum encaminhamento recebido ainda**, então não dá para confirmar se o payload dessa fila também traz o gerente.
- São 5 gerentes distintos.
- Cruzando por e-mail ou CPF/CNPJ, **52 dos 4.304 títulos** do À Receber têm encaminhamento correspondente — hoje a cobertura seria baixa.

## Proposta (somente leitura do que já existe)

1. Na lista e no detalhe do título do À Receber, mostrar "Gerente de contas": nome, e-mail e telefone (botão de WhatsApp/ligar), com a fila de origem (Solar/Consórcio/Incorporador).
2. Ligação título ↔ encaminhamento por CPF/CNPJ (só dígitos) e, se não houver, por e-mail; pega o encaminhamento mais recente.
3. Filtro "Gerente de contas" na listagem, ao lado de "Resp. cobrança".
4. Quando não houver encaminhamento: "Sem gerente vinculado".

## Detalhes técnicos

- Precisa de uma função de leitura nova no banco (`ar_gerente_conta_por_titulo`) — exige sua autorização para a migration; nenhum dado é alterado.
- Telefone do gerente vem de `payload_original->'gerente'->>'telefone'` (não há coluna própria).
- Front: hook novo + exibição no detalhe/listagem do À Receber; sem mexer em Cobranças nem nos dados financeiros.

## Pontos a confirmar

Pedir ao app externo para confirmar que a fila Incorporador envia o mesmo bloco `gerente`.

- Aceita a cobertura atual (52 títulos) ou quer também buscar gerente por outra fonte?