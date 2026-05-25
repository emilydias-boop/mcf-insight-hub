## Objetivo

Permitir registrar e visualizar a **Saúde do Grupo** na aba Grupos da Contemplação, alimentando com os 3 tipos de dado que aparecem nos prints/PDFs Embracon:

1. **Demonstrativo do Grupo** (saude_do_grupo.pdf) — disponibilidades, participantes, bens entregues, próxima parcela.
2. **Calendário de Assembleias** (print) — próximas assembleias (atual + futuras).
3. **Resultado de Assembleias** (ASSEMBLEIA_7270.pdf) — contemplações já confirmadas por assembleia (cota, modalidade, lance %, bem).

A entrada será **manual/colada** (mesmo padrão do `RegistrarAssembleiaModal` atual), sem alterar nenhuma outra tela ou função.

## O que NÃO muda

- Nenhuma alteração em telas/funções fora de `src/components/consorcio/grupos/*` e no engine de recomendação atual.
- Faixas, motor de recomendação, `useGruposSaude`, `GruposTab` e `GrupoCard` continuam como estão.
- Apenas adições novas dentro do `GrupoDetailDrawer`.

## Estrutura de dados (novas tabelas)

```text
consorcio_grupo_saude  (1 linha por grupo, snapshot mais recente)
  grupo (PK), referencia_mes,
  ativos, desistentes_excluidos, quitados, contemplados, nao_contemplados,
  bens_entregues, bens_distribuidos, bens_nao_distribuidos,
  disponibilidades_total, aplic_financeiras, valor_bens_a_entregar,
  proxima_parcela_vencimento, proxima_parcela_valor,
  fonte, atualizado_em

consorcio_calendario_assembleia
  id, grupo, numero, data_assembleia, dia_semana,
  vencimento, sorteio, horario, local
  UNIQUE(grupo, numero)

consorcio_assembleia_resultados   (granularidade por cota contemplada)
  id, assembleia_historico_id (FK), cota, modalidade,
  bem, filial, percentual_lance, parcela, dt_contemplacao
```

`consorcio_assembleias_historico` continua sendo a "âncora" da assembleia (já existe e é lida pelo motor). As novas tabelas só **enriquecem** a visão.

## UI — somente dentro do GrupoDetailDrawer

Adicionar 3 sub-seções colapsáveis abaixo do que já existe:

1. **Saúde Financeira & Participantes** — cards lendo `consorcio_grupo_saude` (Ativos, Quitados, Contemplados, Não Contemp., Bens Entregues/Distribuídos, Disponibilidades). Botão "Atualizar dados" abre modal com campos para colar do demonstrativo.
2. **Calendário de Assembleias** — tabela das próximas N assembleias de `consorcio_calendario_assembleia`. Botão "Importar calendário" abre modal com textarea para colar o bloco do print Embracon (parser simples linha-a-linha).
3. **Resultado da última assembleia** — lista das contemplações vindas de `consorcio_assembleia_resultados` ligadas à última `consorcio_assembleias_historico` do grupo. Botão "Registrar resultado" abre modal de importação (parser do PDF/texto colado).

Cada modal grava na tabela correspondente via Supabase client direto (mesmo padrão atual).

## Indicador de saúde (opcional, mantém compatibilidade)

`useGruposSaude` ganha um JOIN leve com `consorcio_grupo_saude` para mostrar no `GrupoCard` um badge extra "Não Contemp.: X" — só se houver dado. Classificação verde/amarelo/cinza atual fica inalterada.

## Arquivos

- Migration nova: criar as 3 tabelas + RLS (select all auth, insert/update admin/coordenador).
- `src/hooks/useGrupoSaudeDetalhe.ts` — fetch das 3 tabelas para um grupo.
- `src/components/consorcio/grupos/SaudeGrupoSection.tsx`
- `src/components/consorcio/grupos/CalendarioAssembleiasSection.tsx`
- `src/components/consorcio/grupos/ResultadoAssembleiaSection.tsx`
- 3 modais correspondentes em `src/components/consorcio/grupos/modals/`
- Editar **somente** `GrupoDetailDrawer.tsx` para renderizar as 3 seções.

## Parsers

Funções puras em `src/lib/parsers/embraconSaude.ts`:
- `parseDemonstrativo(text)` → extrai Ativos/Desis/Quitados/Contemplados/Não Contemp., Bens, Disponibilidades.
- `parseCalendario(text)` → linhas `grupo nº data diaSemana vencimento sorteio hora`.
- `parseResultadoAssembleia(text)` → linhas de contemplações.

Todos com testes mínimos colocando exemplos dos PDFs anexados como fixture.

## Critérios de aceite

- Abrir um grupo na aba "Grupos" mostra as 3 novas seções; quando vazias exibem CTA "Adicionar".
- Colar texto do demonstrativo / calendário / resultado preenche e salva.
- Nenhuma outra tela (Contemplação, Faixas, Histórico de Assembleias atual, GrupoCard original) muda de comportamento.
