

## Tornar justificativa obrigatória no reagendamento

### Problema
Hoje o campo "Motivo do Reagendamento" existe nos dois modais (R1 e R2) mas é **opcional**. Permite reagendar sem explicar o que aconteceu — perdemos o histórico do "porquê" do no-show ou remarcação.

### Solução
Tornar o campo obrigatório em ambos os modais, exigindo uma frase mínima (não pode ser vazio, espaços em branco ou um simples `-`/`.`).

### Arquivos a alterar

**1. `src/components/crm/RescheduleModal.tsx` (R1)**
- Marcar label como obrigatória: `Motivo do Reagendamento *`
- Validar `rescheduleNote.trim().length >= 10` (mínimo 10 caracteres = força frase real, evita `-`, `.`, `ok`)
- Mostrar contador de caracteres + mensagem de ajuda quando inválido
- Desabilitar botão "Reagendar" enquanto justificativa inválida
- Atualizar `placeholder` para indicar que é obrigatório explicar o motivo
- Trocar `rescheduleNote.trim() || undefined` por sempre enviar `rescheduleNote.trim()`

**2. `src/components/crm/R2RescheduleModal.tsx` (R2)**
- Mesmas mudanças do R1: label obrigatória, validação ≥10 chars trimmed, contador, botão desabilitado, sempre enviar a nota.

### Regra de validação aplicada
```ts
const isNoteValid = rescheduleNote.trim().length >= 10;
```
- Bloqueia: vazio, só espaços, `-`, `ok`, `.`, `xx`
- Permite frases curtas reais como "Cliente não atendeu" (20 chars), "Reagendou via WhatsApp" (22 chars)

### Feedback visual
- Label com asterisco vermelho `*`
- Texto auxiliar abaixo do textarea: "Mínimo 10 caracteres — descreva o que ocorreu (ex: 'Cliente pediu para remarcar para semana que vem')"
- Contador `{rescheduleNote.trim().length}/10` que fica verde quando válido
- Botão "Reagendar" fica desabilitado com tooltip explicando o motivo

### Não muda
- Nenhuma alteração de banco de dados (campo `notes` já existe)
- Hooks de mutation (`useRescheduleMeeting`, `useRescheduleR2Meeting`) permanecem iguais — passam a sempre receber a nota
- Histórico/log de movimentações continua funcionando idêntico
- Contador de "número de reagendamentos" não muda

