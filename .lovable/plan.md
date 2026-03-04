

## Plano: Propagar mudança de nível SDR para o histórico do colaborador

### Problema
Quando o nível do SDR é alterado via Fechamento (SdrConfigTab → `useUpdateSdr`), essa mudança **não gera evento** na aba Histórico do colaborador. O auto-logging que acabamos de construir só funciona para edições via `useUpdateEmployee` (tela RH). São fluxos separados.

Resultado: você mudou de N1 para N2 em março, mas o histórico do colaborador não registrou essa promoção.

### Solução
Adicionar a mesma lógica de detecção de mudanças no `useUpdateSdr` (arquivo `src/hooks/useSdrFechamento.ts`), buscando o `employee` vinculado ao SDR e inserindo o evento em `employee_events`.

### Arquivo: `src/hooks/useSdrFechamento.ts` (hook `useUpdateSdr`, linhas ~1116-1140)

Antes do update:
1. Buscar dados anteriores do SDR (`nivel`, `meta_diaria`, `squad`, `role_type`)
2. Buscar o `employee` vinculado via `sdr_id`

Após o update, para cada mudança detectada:
- `nivel` → evento `promocao`, "Mudança de Nível (SDR)", "Nível X → Nível Y"
- `meta_diaria` → evento `reajuste_meta`, "Ajuste de Meta Diária", "X → Y"
- `role_type` → evento `mudanca_cargo`, "Mudança de Função (SDR)", "sdr → closer" ou vice-versa
- `squad` → evento `troca_squad`, "Troca de Squad (SDR)"

Inserir em `employee_events` usando o `employee.id` encontrado.

### Arquivo: `src/components/fechamento/SdrConfigTab.tsx`
- Sem mudança necessária — já chama `updateSdr.mutateAsync` que será interceptado.

### Resultado esperado
- Editar nível de N1→N2 no Fechamento → evento aparece automaticamente no Histórico do colaborador
- Fechamentos de fevereiro mantêm N1 (congelado no payout), março em diante usa N2
- Eventos manuais e os do `useUpdateEmployee` continuam funcionando normalmente

