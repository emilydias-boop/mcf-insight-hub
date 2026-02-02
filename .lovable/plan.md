
Objetivo
- Fazer o /fechamento-sdr “acompanhar tudo interligado”: RH (employees/cargos_catalogo), Métricas Ativas (fechamento_metricas_mes) e o próprio fechamento (sdr_month_payout / sdr_comp_plan).
- Corrigir especificamente o caso “Thayna é N2, mas aparece N1 com valores errados”.

Causa raiz (o que está quebrando hoje)
1) Nível (N1/N2) no /fechamento-sdr/Index está vindo de `payout.sdr.nivel` (legado) e não do RH:
   - `Index.tsx` usa: `const nivel = payout.sdr?.nivel || 1;`
   - Para closers/SDRs, o nível correto deveria vir de `employees.cargo_catalogo.nivel` (RH é fonte de verdade).

2) O hook `useSdrPayouts` (em `useSdrFechamento.ts`) faz lookup de employee sem filtrar “ativo”:
   - Query atual: `.from('employees').select('... sdr_id, status').not('sdr_id','is',null)`
   - Se existir mais de um registro de employee para o mesmo `sdr_id` (ex.: transferência / histórico / desligado), o Map pode pegar um employee antigo e gerar cargo/BU/nível errados.

3) O /fechamento-sdr/Index não encontra os planos individuais porque filtra status errado:
   - Index.tsx busca compPlans com: `.eq('status','active')`
   - Mas `SdrCompPlan.status` no projeto é `SdrStatus = 'PENDING' | 'APPROVED' | 'REJECTED'`.
   - Ou seja: o Index ignora todos os planos salvos no sistema (por isso OTE e valores ficam no fallback 4000 e parecem “N1 com valores errados”).

O que vamos mudar (implementação)
A) Corrigir integração RH dentro do hook `useSdrPayouts`
Arquivo: src/hooks/useSdrFechamento.ts

1) Ajustar query de employees para usar RH como fonte de verdade:
   - Filtrar somente colaboradores ativos (e evitar pegar histórico):
     - adicionar `.eq('status', 'ativo')`
   - Trazer `cargo_catalogo_id` e join do cargo (nível/valores):
     - select incluindo:
       - `departamento, cargo_catalogo_id, nome_completo, cargo`
       - `cargo_catalogo:cargo_catalogo_id ( id, nome_exibicao, nivel, ote_total, fixo_valor, variavel_valor, area, cargo_base )`

2) Ajustar o Map `sdrToEmployee` para armazenar também:
   - cargo_catalogo_id
   - cargo_catalogo (objeto com nivel/ote/fixo/variavel)
   - (mantém departamento e cargo string)

3) Garantir que filtros e display continuem funcionando:
   - Filtro BU já usa `departamento_vigente > employee.departamento > sdr.squad` (ok)
   - Excluir “Closer R2” continua usando `employee.cargo` (ok)

B) Corrigir a exibição de Nível e OTE no /fechamento-sdr (tela de lista)
Arquivo: src/pages/fechamento-sdr/Index.tsx

1) Nível:
   - Trocar a fonte do nível exibido:
     - prioridade 1: `payout.employee.cargo_catalogo.nivel` (RH)
     - fallback: `payout.sdr.nivel` (legado)
   - Resultado: Thayna N2 aparece como N2 (mesmo que sdr.nivel esteja 1).

2) OTE:
   - Corrigir busca de compPlans (status errado):
     - Remover `.eq('status', 'active')`
     - Substituir por filtro coerente com o tipo atual, por exemplo:
       - incluir PENDING e APPROVED (e excluir REJECTED), ou simplesmente não filtrar por status e pegar o vigente.
   - Definir OTE exibido:
     - prioridade 1: compPlan vigente do `sdr_comp_plan` (se existir e não for REJECTED)
     - fallback: `payout.employee.cargo_catalogo.ote_total` (RH/cargos_catalogo)
     - fallback final: 4000
   - Resultado: OTE e valores “padrão” passam a refletir o cargo real do RH (N2), mesmo quando não existe plano individual.

3) (Opcional, mas recomendado) Mostrar tooltip/indicador “Fonte do nível/OTE”:
   - Ex: “RH” vs “Legado”
   - Isso ajuda a enxergar rapidamente quando existe SDR “órfão” sem vínculo de RH.

C) Corrigir a exibição do nível também no detalhe/export (consistência)
Arquivo: src/pages/fechamento-sdr/Detail.tsx

1) Hoje o export imprime:
   - `const nivel = payout.sdr?.nivel || 1;`
2) Vamos padronizar para usar o mesmo “nível efetivo”:
   - tentar ler o employee/cargo do RH (se o Detail tiver o employee disponível; se não tiver, faremos o Detail buscar o employee ativo pelo `payout.sdr_id`).
3) Resultado: o CSV e o detalhe ficam coerentes com a lista.

D) Validação ponta-a-ponta (para garantir que “tudo está interligado”)
1) Caso Thayna:
   - Confirmar que employees.status = ‘ativo’ para o registro dela e cargo_catalogo_id = Closer Inside N2.
   - Verificar no /fechamento-sdr:
     - Cargo = Closer
     - Nível = N2
     - OTE = ote_total do cargo N2 (ou o plano individual vigente, se existir)
2) Caso Julio (Closer N1):
   - Confirmar que segue N1 e OTE do N1.
3) Caso SDR N2:
   - Confirmar que também passa a usar `cargo_catalogo.nivel` se existir, e mantém fallback para sdr.nivel se não existir vínculo RH.
4) Verificar popup e indicadores:
   - O popup/indicadores já estão dinâmicos por Métricas Ativas; a checagem aqui é garantir que o cargo/nível/valores base (OTE/fixo/variável) estejam coerentes com RH.

Arquivos que serão alterados
- src/hooks/useSdrFechamento.ts
  - Ajustar `useSdrPayouts`: filtrar employees ativos + trazer cargo_catalogo join + enriquecer payout.employee
- src/pages/fechamento-sdr/Index.tsx
  - Corrigir fonte do “Nível”
  - Corrigir query de compPlans (status)
  - Ajustar fallback de OTE para usar RH quando não houver plano
- src/pages/fechamento-sdr/Detail.tsx
  - Padronizar nível/OTE no export/detalhe usando RH quando disponível

Riscos e cuidados
- Se existir colaborador sem vínculo RH (employees.sdr_id vazio), o sistema deve continuar funcionando:
  - Nível cai para `sdr.nivel`
  - OTE cai para 4000 (ou valor padrão) e sinaliza warning (já existe warning de “orphan” na BU; podemos reaproveitar padrão)
- Se houver mais de um employee “ativo” apontando para o mesmo sdr_id (anômalo), ainda pode haver ambiguidade:
  - Vamos manter `.eq('status','ativo')` e, se necessário, ordenar por updated_at/created_at e pegar o mais recente (podemos adicionar isso se identificarmos no código que a query retorna mais de um).

Critério de pronto (o que você vai ver na tela)
- Thayna aparece como:
  - Cargo: Closer
  - Nível: N2 (vindo do RH/cargos_catalogo)
  - OTE/Fixo/Variável coerentes com o cargo N2 (ou com o plano individual vigente)
- O mesmo padrão vale para todos: “tudo interligado” RH + configuração do fechamento.

