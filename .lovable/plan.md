

## Seleção de campos do mapeamento ao duplicar webhook

### Problema
Ao duplicar um webhook, o `field_mapping` inteiro (24 campos) é copiado automaticamente. O usuário quer poder escolher quais mapeamentos copiar (ex: apenas 3 de 24).

### Solução
Adicionar uma seção de checkboxes no formulário de duplicação que lista todos os campos do `field_mapping` do webhook original, permitindo marcar/desmarcar quais mapeamentos incluir.

### Alteração: `src/components/crm/webhooks/IncomingWebhookFormDialog.tsx`

1. **Novo estado** `selectedMappings` — `Set<string>` inicializado com todas as chaves do `duplicateData.field_mapping` (tudo marcado por padrão)
2. **Nova seção UI** visível apenas quando `isDuplicating && duplicateData.field_mapping` tem entradas:
   - Título "Mapeamento de Campos" com botões "Selecionar Todos" / "Limpar"
   - Lista de checkboxes com cada chave do field_mapping mostrando `chave → valor`
3. **No `onSubmit`** (linha 231): filtrar `duplicateData.field_mapping` mantendo apenas as chaves presentes em `selectedMappings`

### UX esperada
```text
┌─ Mapeamento de Campos ─────────────────────┐
│ [Todos] [Limpar]                            │
│ ☑ name → nome_completo                      │
│ ☐ email → email_contato                     │
│ ☑ phone → telefone                          │
│ ☐ cpf → documento                           │
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Resultado
O usuário escolhe exatamente quais campos do mapeamento copiar ao duplicar, sem precisar deletar manualmente depois.

