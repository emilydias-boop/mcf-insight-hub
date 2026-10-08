# Importação Harvey: por que 549 "casos para conferir"

## O que o banco mostra agora (consulta só de leitura, 08/10 17:13)
- 1.314 cards do Harvey na pipeline Relacionamento - Pós venda, todos em "Reunião de Viabilidade 1", nenhum arquivado.
- Por gerente: Kalyanne 314 · Rebeca 360 · William 358 · Vitor 282.
- Esperados: 1.344 cards (1.356 linhas, 12 repetidas). Faltam 30.

## O que são os 549 casos
"Casos para conferir" não quer dizer "cliente não importado". A tela lista três motivos:
1. **Telefone igual ao de outro cadastro, nome diferente**: o cliente entrou mesmo assim, com cadastro novo. Só fica avisado para você conferir. Provavelmente é a maioria dos 549.
2. **Gerente sem login**: o cliente não entrou.
3. **Erro**: o cliente não entrou.

Não tenho a lista dos 549, porque ela só aparece na tela. Por isso, a divisão entre os três motivos ainda não está confirmada.

## Próximos passos (só leitura, sem gravar nada)
1. Comparo os 1.344 códigos do Harvey com os 1.314 cards e listo os 30 que faltam, com gerente, e-mail e telefone.
2. Para cada um dos 30, descubro o motivo provável:
   - gerente sem login;
   - e-mail ou telefone que o bloqueio de duplicidade recusou;
   - dado inválido.
3. Conto quantos cadastros novos foram criados por causa do telefone com nome diferente. Esses são os casos do tipo 1.
4. Entrego um relatório em arquivo: os 30 que faltam com o motivo de cada um, e os casos do tipo 1 para conferência manual.
5. Para completar os 30, você escolhe entre rodar a tela de novo (os 1.314 não duplicam) ou importar só os 30 com um comando. Nada é gravado sem a sua autorização.

## Detalhes técnicos
- Lê os arquivos em /mnt/user-uploads e compara pelo `custom_fields.harvey_cliente_id` em crm_deals (origin POS_VENDA_ORIGIN_ID).
- Os erros vêm das linhas 70, 88 e 149 de ImportarHarvey.tsx. A trava `trg_prevent_duplicate_crm_contact` pode explicar os erros do tipo "duplicate_contact".
