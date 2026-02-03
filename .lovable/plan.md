
## Diagnóstico confirmado (por que a data “volta” ao editar)

O campo **Data de Contratação** está sendo carregado no formulário com:

- `new Date(card.data_contratacao)` (tanto no `defaultValues` quanto no `form.reset()` do modal)

Como `card.data_contratacao` vem do banco no formato **`YYYY-MM-DD`**, o JavaScript interpreta `new Date("2026-01-31")` como **UTC**.  
Quando isso é convertido para o fuso do Brasil (ex.: UTC-3), a hora “cai” para o dia anterior, e o DatePicker passa a mostrar **30/01/2026** (exatamente como no seu print: lista mostra 31/01, editar mostra 30/01).

Isso é um bug clássico de timezone ao usar `new Date("YYYY-MM-DD")`.

O projeto já tem o helper correto para isso: **`parseDateWithoutTimezone()`** em `src/lib/dateHelpers.ts` (inclusive a listagem já usa esse helper para exibir as datas).

---

## Mudança proposta (correção definitiva)

### 1) Ajustar o carregamento da data no ConsorcioCardForm
Arquivo: `src/components/consorcio/ConsorcioCardForm.tsx`

Trocar **todas** as conversões `new Date(<string YYYY-MM-DD>)` por `parseDateWithoutTimezone(<string>)`, pelo menos em:

- `data_contratacao`
- (recomendado também) `data_nascimento`, `data_fundacao`  
  Para evitar o mesmo problema nesses campos quando existirem.

Locais onde isso deve ser feito:
- `useForm({ defaultValues: ... })` quando `card` existe
- `useEffect` que roda `form.reset({ ... })` quando abre o modal em modo edição

### 2) Garantir import do helper
Adicionar/ajustar import no topo do arquivo:

- `import { formatDateForDB, parseDateWithoutTimezone } from '@/lib/dateHelpers';`

(Atualmente o arquivo importa só `formatDateForDB`.)

---

## Como vamos validar que ficou correto

1) Abrir a lista de cotas e anotar a **Data de Contratação** de uma cota (ex.: 31/01/2026).  
2) Clicar em **Editar** na mesma cota.  
3) Confirmar que o campo **Data de Contratação** abre com a **mesma data**, sem “voltar 1 dia”.  
4) (Se aplicarmos também nos outros campos) testar um cadastro com `data_nascimento` e/ou `data_fundacao` para confirmar que não há regressão.

---

## Riscos e efeitos colaterais

- Baixo risco: a alteração só muda **como a string do banco é convertida para Date no front**.
- Não muda o formato salvo no banco, porque o envio já usa `formatDateForDB()` (que é adequado).

---

## Observação importante
O fix anterior que adicionou `observacoes`, `valor_comissao`, etc. no `reset()` está correto e permanece.  
O problema atual é diferente: é **timezone na conversão de data**.

---

## Arquivos envolvidos
- `src/components/consorcio/ConsorcioCardForm.tsx` (ajustar parsing de datas)
- `src/lib/dateHelpers.ts` (já existe `parseDateWithoutTimezone`, não precisa mudar)

