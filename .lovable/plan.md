# Trazer a anamnese do HARVEY para os clientes importados

## O que acontece hoje (conferido no banco)
- Os 3 arquivos da importação (clientes, atividades, encaminhamentos) não traziam anamnese. Por isso os 1.314 cards do Harvey entraram sem ela.
- A anamnese só chega aqui quando o HARVEY envia a ficha para o recebimento próprio do Pós Venda. Até agora só 8 cards do Pós Venda têm anamnese. Outras 15 fichas estão guardadas esperando o cliente aparecer.
- Wesley Lopes Pereira: o card dele tem os dados do Harvey (coluna, prioridade, CPF, encaminhamentos), mas nenhuma anamnese. Por isso aparece "Verificar anamnese no HARVEY".

## Proposta
1. **Envio em lote pelo HARVEY (recomendado):** passo um texto para colar no HARVEY. Ele pede que o HARVEY reenvie a anamnese de todos os clientes da carteira para o recebimento do Pós Venda, com e-mail ou telefone do cliente e as seções (Contato, Objetivos, Patrimônio, Financeiro, Planejamento). Cada ficha cai no card certo, e a etiqueta some sozinha.
2. **Alternativa por arquivo:** se o HARVEY exportar as anamneses num arquivo (CSV ou JSON), acrescento esse arquivo na tela "Importar Harvey". As fichas seriam ligadas pelo código do cliente no Harvey, que já está nos 1.314 cards. Nada mais no card é alterado.
3. **Fichas guardadas:** confiro por que as 15 fichas guardadas não acharam card. Se forem clientes que já estão na pipeline com e-mail ou telefone diferente, ligo pelo CPF, com sua autorização.

## Detalhes técnicos
- Destino: `custom_fields.anamnese_v2` (mesmo formato usado por `pos-venda-anamnese` e pelo botão "Ver anamnese"); o merge mantém as outras chaves.
- Opção 2: novo upload opcional em `ImportarHarvey.tsx`, casando por `harvey_cliente_id`; só preenche se `anamnese_v2` estiver vazio.
- Opção 3: incluir CPF (`custom_fields.cpf`) como chave de busca em `pos-venda-anamnese` e em `pos_venda_aplicar_anamnese_pendente`.
- Sem mudança em outras BUs, em métricas ou em dados financeiros.
