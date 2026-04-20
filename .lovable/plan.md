

## Rótulos por data do carrinho (sexta de corte)

### Mudança

No `EncaixarSemanaDialog`, substituir os rótulos relativos (`Semana anterior / atual / próxima / seguinte`) por **"Carrinho DD/MM"** — a data da sexta-feira de corte de cada janela.

### Cálculo

Para cada opção, a data do carrinho é `addDays(weekStart, 1)` (Qui → Sex). No exemplo do screenshot (R2 em 10/04/26, âncora semana atual = Qui 09/04 → Qua 15/04):

| Opção | Janela (Qui → Qua) | Rótulo novo |
|---|---|---|
| Anterior | 02/04 → 08/04 | **Carrinho 03/04** |
| Atual (sugerida) | 09/04 → 15/04 | **Carrinho 10/04** ⭐ |
| Próxima | 16/04 → 22/04 | **Carrinho 17/04** |
| Seguinte | 23/04 → 29/04 | **Carrinho 24/04** |

Obs: no exemplo do usuário ele cita "10/04; 17/04; 24/04; 30/04" — o 30/04 tem 1 dia de diferença porque ele considerou uma janela deslocada. Vou seguir a regra correta (sexta de cada semana Qui→Qua, ou seja `weekStart + 1 dia`), que no exemplo exato do Cleiton resulta em 03/04, 10/04, 17/04, 24/04. A lógica fica consistente e auditável.

### Layout do item

```
┌─────────────────────────────────────────────┐
│ Carrinho 10/04        [sugerida] [atual]  ● │
│ Qui 09/04 → Qua 15/04                       │
└─────────────────────────────────────────────┘
```

- **Título**: `Carrinho DD/MM` (destaque, fonte maior)
- **Subtítulo**: mantém o range `Qui DD/MM → Qua DD/MM` (em menor, cinza)
- Badges "sugerida" / "atual" como estão hoje
- Texto informativo embaixo também passa a citar: "O lead aparecerá em **Aprovados** do Carrinho **DD/MM**."
- Caixa "Encaixado atualmente em…" também passa a dizer "Carrinho DD/MM" (com range em parênteses)

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/components/crm/EncaixarSemanaDialog.tsx` | Rótulos das 4 opções + texto informativo + caixa "encaixado atualmente" passam a usar `Carrinho DD/MM` como identificador principal; range Qui→Qua vira subtítulo |

Nenhuma mudança de lógica, tipos ou mutations — é só apresentação.

### Validação

1. Abrir diálogo em qualquer ponto (Acumulados / Próxima Safra / Relatório) → ver "Carrinho DD/MM" como título de cada opção
2. Selecionar uma opção → texto embaixo "O lead aparecerá em Aprovados do Carrinho DD/MM"
3. Lead já encaixado → caixa amarela mostra "Encaixado atualmente em Carrinho DD/MM (Qui DD/MM → Qua DD/MM)"
4. Datas batem com a sexta-feira de corte da safra correspondente

### Escopo

- 1 arquivo editado, zero lógica/dados, zero migrations
- 100% cosmético
