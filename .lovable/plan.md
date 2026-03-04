

## Plano: Auto-registrar eventos no histórico ao editar colaborador

### Problema
Quando campos importantes são alterados (cargo, nível, squad, gestor, salário, status, departamento), nenhum evento é registrado automaticamente no histórico — exceto mudança de departamento, que já existe mas não é acionada porque `previousData` não é passado pelos componentes.

### Solução
Centralizar a lógica de detecção de mudanças no `updateEmployee` mutation (em `useEmployees.ts`) e auto-inserir eventos em `employee_events` para cada campo relevante alterado.

### Arquivo: `src/hooks/useEmployees.ts` (mutation `updateEmployee`)

Expandir a lógica existente (linhas 159-197) para:

1. **Buscar dados anteriores do banco** antes do update (em vez de depender de `previousData` passado pelo componente):
   ```typescript
   // Antes do update, buscar o registro atual
   const { data: previous } = await supabase
     .from('employees')
     .select('cargo, cargo_catalogo_id, nivel, squad, gestor_id, departamento, salario_base, status')
     .eq('id', id)
     .single();
   ```

2. **Após o update**, comparar e inserir eventos para cada mudança detectada:
   - `cargo` → tipo `mudanca_cargo`, "Mudança de Cargo", valor anterior → novo
   - `nivel` → tipo `promocao`, "Mudança de Nível", nível X → nível Y
   - `squad` → tipo `troca_squad`, "Troca de Squad"
   - `gestor_id` → tipo `mudanca_gestor`, "Mudança de Gestor" (resolver nome do gestor)
   - `departamento` → tipo `transferencia`, "Transferência de Departamento" (já existe, mas centralizar)
   - `salario_base` → tipo `reajuste`, "Reajuste Salarial", R$ X → R$ Y
   - `status` → tipo correspondente (`desligamento`, `afastamento`, `retorno`), título adequado

3. **Resolver nomes** para `gestor_id` (buscar `nome_completo` do gestor anterior e novo para exibição legível nos campos `valor_anterior`/`valor_novo`).

4. **Inserir em batch** (`supabase.from('employee_events').insert(eventsToCreate)`) todos os eventos detectados de uma vez.

### Arquivo: `src/components/hr/tabs/EmployeeGeneralTab.tsx`
- Remover a necessidade de passar `previousData` manualmente (a lógica agora é interna ao mutation).
- Nenhuma mudança funcional necessária nos componentes — eles já chamam `updateEmployee.mutate({ id, data })`.

### Arquivo: `src/components/hr/tabs/EmployeeRemunerationTab.tsx`
- Idem — já funciona sem mudança, pois o mutation detectará alterações em `salario_base` e `nivel` automaticamente.

### Campos monitorados e tipos de evento

| Campo alterado | `tipo_evento` | Título auto | valor_anterior → valor_novo |
|---|---|---|---|
| `cargo` | `mudanca_cargo` | Mudança de Cargo | cargo antigo → novo |
| `nivel` | `promocao` | Mudança de Nível | Nível X → Nível Y |
| `squad` | `troca_squad` | Troca de Squad | squad antigo → novo |
| `gestor_id` | `mudanca_gestor` | Mudança de Gestor | nome antigo → nome novo |
| `departamento` | `transferencia` | Transferência de Departamento | dept antigo → novo |
| `salario_base` | `reajuste` | Reajuste Salarial | R$ X → R$ Y |
| `status` | `desligamento`/`afastamento`/`retorno` | conforme status | status antigo → novo |

### Resultado esperado
- Toda edição de colaborador que altere campos relevantes gera automaticamente um registro no histórico
- O tab "Hist." mostra timeline completa de mudanças sem necessidade de registro manual
- Eventos manuais continuam funcionando normalmente via botão "Adicionar Evento"

