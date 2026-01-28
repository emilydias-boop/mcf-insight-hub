
## Diagnóstico (por que ainda está desalinhado)

Pelo código atual, a coluna **Closer R2** ganhou `w-[140px]` no `<TableHead>` e no `<TableCell>`, mas o `<table>` está com **layout automático** (padrão do HTML). Nesse modo:
- O navegador **redistribui as larguras** baseado no conteúdo (ex.: nome do lead, badges, etc.).
- Mesmo com `w-[140px]`, o `table-layout: auto` pode “puxar” e **variar o alinhamento visual** conforme o conteúdo de outras colunas.
- Além disso, quando `att.closer_color` é `null`, o “pontinho” não renderiza e o texto do closer **começa mais à esquerda** do que nas linhas que têm pontinho, parecendo “arrastado”.

## Objetivo do ajuste
1) Garantir que a tabela use **layout fixo** (colunas com largura realmente estável).
2) Garantir que o conteúdo da célula de closer tenha **prefixo com largura constante** (pontinho sempre ocupa espaço), mantendo o texto alinhado.
3) (Relacionado ao que você comentou antes) Garantir que o filtro de status mostre **todos os status** e principalmente os **sem atualização**, mesmo quando o `r2_status_name` estiver vindo nulo por causa do mapeamento.

---

## Mudanças propostas

### A) Travar layout da tabela (resolver desalinhamento estrutural)
**Arquivo:** `src/components/crm/R2AgendadasList.tsx`

- Adicionar `table-fixed` na tabela:
  - ` <Table className="table-fixed"> ... </Table> `
- Definir largura também para as outras colunas para reduzir “efeito sanfona”:
  - Horário: `w-[80px]`
  - Dia R1: `w-[90px]`
  - Closer: `w-[160px]` (podemos aumentar um pouco para nomes longos) + `min-w-[160px]`
  - Status: `w-[180px]` + `min-w-[180px]` (porque badges/CP podem variar)
  - Nome Lead fica como a coluna “flexível” (sem width fixa)

**Resultado esperado:** as colunas deixam de mudar de largura dependendo do conteúdo e o alinhamento vertical por coluna fica estável.

---

### B) Alinhamento interno do conteúdo “Closer” (resolver “arrastando o nome”)
**Arquivo:** `src/components/crm/R2AgendadasList.tsx`

Hoje o “pontinho” só aparece quando `att.closer_color` existe. Em linhas sem cor, o texto começa antes.

- Renderizar **sempre** um “slot” do pontinho com largura fixa:
  - Se tiver cor: bolinha normal
  - Se não tiver cor: bolinha “invisível” (`opacity-0`) ou `bg-transparent`, mas ocupando o mesmo espaço

Exemplo de abordagem:
- Trocar:
  - ` {att.closer_color && <div className="w-2.5 h-2.5 ..." />}`
- Por:
  - `<div className="w-2.5 h-2.5 rounded-full shrink-0" style={...} />`
  - Quando não houver cor, usar `opacity-0` (mantém espaço) e remover o `style`.

- Completar com:
  - `truncate` e `whitespace-nowrap` no texto para nunca quebrar linha e empurrar layout.

**Resultado esperado:** o nome do closer começa sempre no mesmo X (mesma “coluna interna”), independente de ter cor ou não.

---

### C) “Status faltando” (garantir lista completa e incluir não atualizados)
O componente já adiciona “Pendente (Sem avaliação)” quando `r2_status_id` é nulo. Porém você relatou que só aparece “Aprovado” e o resto não.

A causa mais provável (pela arquitetura atual):
- `useR2CarrinhoData` busca `r2_status_options` com `.eq('is_active', true)`.
- Se existem status antigos/inativos, o attendee pode ter `r2_status_id` preenchido, mas o `statusMap` não encontra o nome => `r2_status_name` vira `null`.
- Assim:
  - A lista `r2Statuses` no `R2AgendadasList` não consegue listar esses status (porque depende de `r2_status_name`).
  - O render do status pode cair no fallback (posição) ou parecer “vazio” dependendo do layout/badge.

**Ajuste proposto (mínimo e efetivo):**
**Arquivo:** `src/hooks/useR2CarrinhoData.ts`
- Alterar a query de status options para trazer **todos** os status (remover o filtro `is_active = true`) pelo menos para o carrinho/listagens:
  - de: `.eq('is_active', true)`
  - para: (sem esse filtro) ou `.select('id,name')` sem restrição

**E no componente `R2AgendadasList.tsx`**
- Ao montar `r2Statuses`, considerar também casos em que:
  - `att.r2_status_id` existe, mas `att.r2_status_name` ainda é nulo (isso deve diminuir muito após o ajuste no hook).
  - Se ainda ocorrer, exibir um label fallback tipo: `Status (sem nome)` para não “sumir”.

**Resultado esperado:**
- O dropdown de status passa a listar: Aprovado, Em análise, Reprovado, Desistente etc.
- E “Pendente (Sem avaliação)” continua cobrindo quem não tem status.

---

## Checklist de validação (QA)
1) Na tab **Todas R2s**, olhar 3 dias diferentes e confirmar:
   - “Closer R2” está alinhado (texto sempre começa na mesma posição).
   - A largura da coluna não oscila conforme nomes/badges.
2) Filtrar por:
   - Status: “Pendente (Sem avaliação)”
   - Status: um status diferente de Aprovado (ex.: Reprovado/Em análise) e confirmar que aparece.
3) Testar em tela menor (responsivo) com scroll horizontal:
   - Tabela permanece estável e legível.

---

## Arquivos que serão alterados
- `src/components/crm/R2AgendadasList.tsx`
  - `Table` com `table-fixed`
  - widths/min-widths nas colunas
  - “slot fixo” do pontinho do closer (mesmo sem cor)
- `src/hooks/useR2CarrinhoData.ts`
  - buscar `r2_status_options` sem restringir por `is_active`, para não perder nomes de status existentes nos dados

---

## Riscos e cuidados
- Remover o filtro `is_active` pode expor status antigos no mapeamento (somente leitura/visualização). Isso é desejado aqui para não “sumir” status históricos.
- Caso exista algum lugar no app que dependa estritamente de “ativos” para criação/edição (select de edição), manteremos esses outros hooks como estão (somente o `useR2CarrinhoData` muda para exibição correta).
