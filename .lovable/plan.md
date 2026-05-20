# Diagnóstico

A mensagem chegou trocada porque o template **Confirmação Reunião Agendada** (`HXe342197a5ce4f8a1d79ca37d2eff6c52`) está com `variables = [nome, link]` no banco, mas o corpo no Twilio tem 4 placeholders posicionais `{{1}}..{{4}}` (nome, data/hora, closer, link).

Resultado: o `automation-processor` monta `ContentVariables` apenas para `{{1}}=nome` e `{{2}}=link`. O Twilio então:
- `{{2}}` recebe o link → aparece em "Data e horário"
- `{{3}}` e `{{4}}` ficam vazios → Twilio renderiza os *sample values* ("Exemplo closer" / "Exemplo link")

O template "Lembrete D-1" já está correto (`[nome, data_hora, closer, link]`), por isso é só alinhar este.

# Mudança

Migration de 1 linha:

```sql
UPDATE public.automation_templates
SET variables = ARRAY['nome','data_hora','closer','link']
WHERE id = 'cf53890c-…' -- na verdade: 6ce02063-d194-4338-b48c-11cc331aafdb (Confirmação)
```

# Validação

1. Re-disparar `automation-enqueue` + `automation-processor` para o deal de teste do William (slot 21/05/2026 09:00, link `meet.google.com/teste-mcf-001`).
2. Conferir no WhatsApp (+55 21 96738-5623) que o template chega com:
   - Data e horário: **21/05/2026 às 09:00**
   - Especialista: **William Ferreira**
   - Link: **https://meet.google.com/teste-mcf-001**

# Observação

Pré-condição: o template no Twilio Content Builder precisa estar registrado com os 4 placeholders nesta ordem posicional. Pelo retorno do teste (link caiu em `{{2}}`), parece ser exatamente o caso — apenas o array no banco está incompleto.
