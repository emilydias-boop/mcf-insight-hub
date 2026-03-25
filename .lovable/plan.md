

## Aumentar largura do drawer do Controle Diego

### Problema
O drawer lateral tem 620px de largura, ficando apertado para exibir os dados do lead.

### Solução
Aumentar a largura de `w-[620px]` para `w-[820px]` no `SheetContent` em `src/components/relatorios/ControleDiegoDrawer.tsx` (linha 201). Isso fará o drawer ocupar mais espaço horizontal, alinhando aproximadamente com a coluna "Pendentes" do Kanban.

### Arquivo alterado
- `src/components/relatorios/ControleDiegoDrawer.tsx` — linha 201: `w-[620px]` → `w-[820px]`

