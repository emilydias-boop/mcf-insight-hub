## Situação

O gatilho do webhook do Make (`consorcio.carta.cadastrada`) já está exatamente como você quer: dispara apenas ao confirmar o modal **Cadastrar Dados da Cota → "Confirmar e Enviar para Controle Consórcio"**, em "Cartas Negociadas".

Fluxo atual verificado:
1. O Closer preenche o checklist completo da cota e anexa documentos.
2. Ao confirmar, o cadastro pendente é criado em `consorcio_pending_registrations`.
3. Em seguida a edge function `consorcio-carta-cadastrada-webhook` é chamada com `registration_id` + `proposal_id`.
4. O payload é montado por hierarquia (cadastro pendente → proposta → carta física), então vai completo mesmo antes de "Abrir cota".
5. Se faltar titular, contato ou valor de crédito, o envio é bloqueado (`skipped`) — nada de payload vazio.
6. Idempotência garantida pela flag `webhook_carta_cadastrada_enviado_em`; reenvio manual segue disponível no botão "Reenviar webhook".

## Ação

Nenhuma alteração de código necessária. Nada a implementar neste momento.
