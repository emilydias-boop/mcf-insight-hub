# Atualizar texto final do template "Confirmação Reunião Agendada — MCF Capital"

## Mudança

No template `automation_templates` id `6ce02063-d194-4338-b48c-11cc331aafdb`, substituir a última linha do corpo:

**Antes:**
> Caso precise remarcar, responda esta mensagem.

**Depois:**
> O especialista separou esse horário porque viu potencial no seu caso. Como a agenda é limitada, contamos com o seu comprometimento.

## Como aplicar

Criar uma migração SQL:

```sql
UPDATE public.automation_templates
SET content = replace(content,
  'Caso precise remarcar, responda esta mensagem.',
  'O especialista separou esse horário porque viu potencial no seu caso. Como a agenda é limitada, contamos com o seu comprometimento.'
),
updated_at = now()
WHERE id = '6ce02063-d194-4338-b48c-11cc331aafdb';
```

Nada mais muda — variáveis (`{{nome}}`, `{{data_hora}}`, `{{closer}}`, `{{link}}`) e assinatura "— MCF Capital" permanecem.
