

## Acessar "Apoio R1" direto da tela `/crm/configurar-closers`

### Diagnóstico

Hoje existem **duas telas** de closers:

- `/crm/configurar-closers` (a que você está vendo) — lista global, todos os closers de todas as BUs (R1 + R2 misturados). É onde a maioria entra.
- `/crm/configurar-closers-r2` — tela separada e específica de R2. **É lá que está o botão Apoio R1 (ícone salva-vidas)** que adicionamos no passo anterior.

Como você nunca abre essa tela secundária, parece que o recurso "sumiu". Solução: trazer o botão para a tela principal, dentro da linha de cada closer R2.

### Mudança proposta

Editar **`src/pages/crm/ConfigurarClosers.tsx`** para:

1. **Incluir `meeting_type` no tipo `Closer`** (`src/hooks/useClosers.ts`) — campo já existe no banco, só não estava tipado.
2. **Adicionar item "Apoio R1" no DropdownMenu** (aquele `...` no fim da linha) **somente quando**:
   - `closer.meeting_type === 'r2'` E
   - `closer.is_active === true`
3. Ao clicar, abre um `Dialog` reutilizando o componente já existente `<R1SupportDaysConfig closer={closer} />` (precisa adaptar tipo: o componente espera `R2Closer`, mas só usa `id`, `name` e `color` — ajustamos para aceitar um shape mais leve, ou convertemos no momento da abertura).
4. Estado novo na página: `supportConfigOpen` + `supportCloser`.
5. Ícone do item: `LifeBuoy` (mesma identidade visual da outra tela).
6. Para closers que **não são R2**, o item não aparece — mantém o menu limpo (só Editar/Excluir).

### Resultado visual

No menu `...` de cada linha:

```text
Closer R2 ativo (Jessica Bellini R2):
  • Editar
  • Apoio R1            ← novo, com ícone salva-vidas
  • Excluir

Closer R1 ou inativo (todos os demais):
  • Editar
  • Excluir             (sem mudança)
```

O Dialog que abre é exatamente o mesmo da tela R2: calendário pt-BR, toggle "Dia inteiro / Janela específica", lista de datas liberadas, validações etc. Nenhuma lógica de backend muda.

### Arquivos afetados

- `src/hooks/useClosers.ts` — adicionar `meeting_type: 'r1' | 'r2' | null` na interface `Closer`.
- `src/pages/crm/ConfigurarClosers.tsx` — novo `DropdownMenuItem` condicional + estado + Dialog `R1SupportDaysConfig`.
- `src/components/crm/R1SupportDaysConfig.tsx` — afrouxar o tipo da prop `closer` para aceitar `{ id: string; name: string; color?: string | null }` (compatível com `Closer` e `R2Closer`).

Nenhuma migration, nenhuma alteração em hook de dados ou edge function.

### Validação pós-implementação

1. Abrir `/crm/configurar-closers` → no menu `...` da Jessica Bellini R2 (e demais R2 ativos) aparece "Apoio R1".
2. Clicar abre o mesmo modal que já existe em `/crm/configurar-closers-r2` (calendário + lista).
3. Liberar uma data → toast de sucesso, dia destacado.
4. No menu `...` de um closer R1 (ex.: Claudia Carielo) o item "Apoio R1" **não aparece**.
5. No menu `...` de um closer R2 inativo, também não aparece.

