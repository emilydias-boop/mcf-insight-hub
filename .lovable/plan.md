
# Fallback do Numero Base para Consulta por Loteria Federal

## Resumo

Quando o numero base (ultimos 5 digitos) esta fora do range de cotas do grupo, o sistema deve automaticamente reduzir os digitos (4, 3, 2, 1) ate encontrar um candidato valido. Hoje retorna "nenhuma cota encontrada", o que esta incorreto.

---

## O que muda

1. Nova funcao de fallback em `contemplacao.ts` que testa candidatos por reducao de digitos
2. O range maximo do grupo e determinado dinamicamente a partir das cotas existentes no banco (maior numero de cota do grupo)
3. A UI mostra transparencia: numero informado, numero aplicado e motivo do fallback
4. O registro de auditoria salva o numero aplicado alem do numero base original

---

## Parte 1 - Logica de fallback (`src/lib/contemplacao.ts`)

Nova funcao `calcularNumeroAplicado`:

```text
Entrada: numeroLoteria = "25648", cotas do grupo (array de numeros)

Passo 1: Determinar max_cota do grupo (maior numero de cota existente)
Passo 2: Gerar candidatos por reducao:
  - base_5 = ultimos 5 digitos = 25648
  - base_4 = ultimos 4 digitos = 5648
  - base_3 = ultimos 3 digitos = 648
  - base_2 = ultimos 2 digitos = 48
  - base_1 = ultimo 1 digito  = 8

Passo 3: Para cada candidato (na ordem 5 -> 4 -> 3 -> 2 -> 1):
  - Se candidato >= 1 E candidato <= max_cota: aceitar
  - Senao: proximo candidato

Retorno:
  - numeroAplicado: string (ex: "648")
  - numeroBase: string (ex: "25648")
  - fallbackAplicado: boolean
  - motivoFallback: string (ex: "25648 e 5648 fora do range (max: 5000), usando 648")
  - candidatosTestados: string[] (para debug)
```

Atualizar `classificarCotasPorLoteria` para usar o `numeroAplicado` em vez do `numeroBase` direto.

---

## Parte 2 - Atualizar a UI (`ContemplationTab.tsx`)

### Na barra de resumo (badges), trocar de:
"Numero base: 25648"

### Para:
- Numero base (5 digitos): 25648
- Numero aplicado: 648
- Motivo: "5648 fora do range (max: 5000)"

Quando nao houver fallback (numero base ja valido), mostrar apenas:
- Numero aplicado: 25648

### Mensagem de fallback
Exibir um Alert adicional (tipo info) quando o fallback for aplicado, explicando:
"O numero base 25648 esta fora do range do grupo (max: XXXX). O sistema aplicou reducao automatica e esta usando o numero 648."

---

## Parte 3 - Atualizar auditoria

No `useRegistrarConsultaLoteria`, passar tambem o `numeroAplicado` para salvar no registro.
Adicionar coluna `numero_aplicado` na tabela `consorcio_consulta_loteria` (migration).

---

## Parte 4 - Determinar max_cota do grupo

Em vez de configuracao manual por grupo, o sistema calcula automaticamente:
- max_cota = maior numero de cota encontrada no grupo selecionado (via query existente)
- Isso e derivado dos dados ja carregados em `cards`

Se futuramente for necessario configuracao manual, pode ser adicionado sem quebrar esta logica.

---

## Detalhes tecnicos

### Arquivos a modificar
1. `src/lib/contemplacao.ts` - Adicionar `calcularNumeroAplicado()` e atualizar `classificarCotasPorLoteria()` para receber max_cota e aplicar fallback
2. `src/components/consorcio/ContemplationTab.tsx` - Usar nova funcao, exibir info de fallback na UI, passar numero aplicado para auditoria
3. `src/hooks/useContemplacao.ts` - Adicionar campo `numeroAplicado` no mutation de registro

### Migration SQL
- Adicionar coluna `numero_aplicado text` na tabela `consorcio_consulta_loteria`

### Tipos novos em `contemplacao.ts`

```text
interface ResultadoFallback {
  numeroBase: string         -- ultimos 5 digitos originais
  numeroAplicado: number     -- numero efetivamente usado
  fallbackAplicado: boolean
  motivoFallback: string     -- explicacao legivel
  candidatosTestados: { candidato: number, valido: boolean, motivo: string }[]
}
```

### Sequencia de implementacao
1. Migration SQL (adicionar coluna numero_aplicado)
2. Atualizar `contemplacao.ts` com funcao de fallback
3. Atualizar `ContemplationTab.tsx` com exibicao de fallback
4. Atualizar hook de auditoria
