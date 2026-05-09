## Objetivo
No diálogo "Testar template" (criado na rodada anterior), permitir escolher o **dono** a partir dos `employees` cadastrados, com **Carol Correa** (`carol.correa@minhacasafinanciada.com` / `11990219017`) como padrão — em vez de digitar nome/telefone do dono manualmente.

## Mudanças

### 1. `src/components/automations/TemplateTestSendDialog.tsx`
- Buscar via `supabase.from('employees').select('id, nome_completo, email_pessoal, telefone').not('telefone','is',null).order('nome_completo')` ao abrir o diálogo.
- Substituir os dois inputs de "Dono (nome)" e "Dono (telefone)" por um único `Select` "Dono (employee)" com a lista de funcionários (rótulo: `Nome — telefone`).
- Default selecionado: o employee cujo `email_pessoal = 'carol.correa@minhacasafinanciada.com'` (fallback: primeiro da lista).
- Ao enviar, derivar `ownerName` e `ownerPhone` do employee selecionado e continuar chamando `automation-test-send` exatamente como hoje (mesmo payload).
- Manter campos de telefone de destino e nome do contato como estão.
- Mostrar abaixo do select um hint pequeno: "Token wa_agendar_token será gerado para este dono".

### 2. Sem mudanças em backend
- A edge function `automation-test-send` já aceita `ownerPhone` / `ownerName` no body — nada muda nela.
- Sem migrations.

## Como testar depois
1. `/admin/automacoes` → template **Boa Vindas** → **Testar**.
2. Verificar que o select já vem com **Carol Correa — 11990219017**.
3. Telefone destino: `11993666464` → **Enviar teste**.
4. Confirmar no toast `messageSid` e que `contentVariables` contém `wa_agendar_token` apontando para Carol.