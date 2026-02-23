
# Simulador de Contemplacao por Loteria Federal

## Resumo

Transformar a aba "Contemplacao" de uma lista estatica para um simulador baseado no numero da Loteria Federal, classificando cotas em zonas de chance (match direto, +/-50, +/-100) com recomendacoes de lance.

---

## O que muda

A aba mantem a tabela existente e todos os modais/acoes atuais, mas ganha:

1. Uma secao de consulta no topo (Grupo + Periodo + Numero da Loteria)
2. Logica de classificacao em 3 zonas (Embracon)
3. Duas novas colunas na tabela (Categoria de Chance + Recomendacao de Lance)
4. Registro de cada consulta no banco (auditoria)
5. Aviso legal no topo dos resultados

---

## Parte 1 - Migration SQL

Criar tabela `consorcio_consulta_loteria` para registrar cada consulta:
- id (uuid PK)
- grupo (text)
- periodo (text) -- ex: "2026-02" ou data da assembleia
- numero_loteria (text) -- numero informado pelo usuario
- numero_base (text) -- ultimos 5 digitos calculados
- cotas_match (integer) -- quantas cotas deram match direto
- cotas_zona_50 (integer) -- quantas na zona +/-50
- cotas_zona_100 (integer) -- quantas na zona +/-100
- created_by (uuid FK auth.users)
- created_at (timestamptz default now())

RLS: autenticados podem inserir e ler.

---

## Parte 2 - Atualizar `contemplacao.ts`

Adicionar nova funcao `classificarCotasPorLoteria`:
- Recebe: numero da loteria (string), lista de cotas (ConsorcioCard[])
- Extrai ultimos 5 digitos do numero (nao 4 como a funcao atual)
- Para cada cota, calcula distancia numerica entre o numero da cota e o numero base
- Classifica em:
  - **Match Sorteio**: distancia == 0
  - **Zona +/-50**: distancia <= 50
  - **Zona +/-100**: distancia <= 100
  - **Fora**: distancia > 100
- Retorna array com cota + zona + recomendacao de lance, ordenado por zona

---

## Parte 3 - Atualizar `useContemplacao.ts`

Adicionar:
- `useRegistrarConsultaLoteria()`: mutation para salvar consulta na tabela de auditoria
- Manter `useContemplationCards` existente (usada para buscar cotas do grupo selecionado)

---

## Parte 4 - Reescrever `ContemplationTab.tsx`

### Nova secao no topo: "Consulta por Sorteio da Loteria Federal"
- Card com 3 campos lado a lado:
  - **Grupo** (Select obrigatorio, carregado de grupos existentes via query)
  - **Assembleia / Periodo** (input mes/ano, formato MM/AAAA)
  - **Numero da Loteria Federal** (input numerico, placeholder "012345")
- Botao "Calcular possibilidades"

### Comportamento ao clicar "Calcular possibilidades"
1. Busca todas as cotas do grupo selecionado via `useContemplationCards`
2. Aplica `classificarCotasPorLoteria` no frontend
3. Filtra tabela para mostrar apenas cotas com match, zona 50 ou zona 100
4. Salva consulta em `consorcio_consulta_loteria`

### Aviso legal
Alert acima da tabela apos consulta:
"Esta e uma previsao baseada no numero da Loteria Federal e proximidade das cotas. A contemplacao real depende da assembleia da Embracon e dos lances realizados."

### Tabela atualizada
Manter todas as colunas atuais + adicionar 2 novas:
- **Categoria de Chance**: Badge colorido (Match Sorteio / Zona +/-50 / Zona +/-100)
- **Recomendacao de Lance**: Texto (Contemplacao por sorteio / Ate 25% / Ate 50%)

Ordenacao: Match direto primeiro, depois Zona 50, depois Zona 100.

Quando nao houver consulta ativa, mostrar todas as cotas normalmente (comportamento atual).

### Acoes existentes mantidas
Botoes Ver detalhes, Verificar sorteio e Simular lance continuam funcionando.

---

## Detalhes tecnicos

### Arquivos a modificar
1. `src/lib/contemplacao.ts` -- adicionar `classificarCotasPorLoteria` e tipos
2. `src/hooks/useContemplacao.ts` -- adicionar `useRegistrarConsultaLoteria` e query de grupos
3. `src/components/consorcio/ContemplationTab.tsx` -- reescrever com secao de consulta

### Arquivo a criar
1. Migration SQL para `consorcio_consulta_loteria`

### Logica de classificacao (funcao pura, sem banco)
```text
entrada: numero_loteria = "012345", cotas do grupo 7253
numero_base = 12345 (ultimos 5 digitos)

Para cada cota:
  distancia = |cota_numero - numero_base|

  se distancia == 0 -> Match Sorteio, "Contemplacao por sorteio"
  se distancia <= 50 -> Zona +-50, "Ate 25%"
  se distancia <= 100 -> Zona +-100, "Ate 50%"
  senao -> excluir da lista
```

### Sequencia de implementacao
1. Migration SQL (tabela consorcio_consulta_loteria)
2. Atualizar `contemplacao.ts` com nova funcao de classificacao
3. Atualizar `useContemplacao.ts` com mutation de registro
4. Reescrever `ContemplationTab.tsx` com secao de consulta + tabela atualizada
