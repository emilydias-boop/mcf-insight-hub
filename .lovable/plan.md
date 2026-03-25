
## Fluxo atual

O step de Preview mostra apenas os 10 primeiros registros e não faz nenhuma checagem de duplicidade no banco. O `handleImport` insere tudo de uma vez sem filtrar.

## O que o usuário quer

1. No step de Preview: checar TODOS os nomes do arquivo contra `consortium_payments.consorciado` no banco
2. Mostrar claramente quais estão duplicados (destacados em vermelho com nome e contrato já existente)
3. Exibir um painel de "aprovação": o usuário vê a lista dos duplicados encontrados e pode escolher:
   - **Bloquear todos** (padrão) — duplicados não entram
   - **Desbloquear individualmente** — marca certos duplicados como "permitir mesmo assim"
4. Só após confirmar a revisão, libera o botão "Importar Dados"
5. No `handleImport`: duplicados bloqueados são pulados, contagem separada no resultado final

## Mudanças no arquivo `src/pages/bu-consorcio/Importar.tsx`

### 1. Interface `ParsedRow`
Adicionar dois campos:
```ts
isDuplicate?: boolean;
allowDuplicate?: boolean; // usuário desativou o bloqueio manualmente
```

### 2. Estados novos
```ts
const [duplicatesReviewed, setDuplicatesReviewed] = useState(false);
const [checkingDuplicates, setCheckingDuplicates] = useState(false);
const [importStats, setImportStats] = useState<{ imported: number; blocked: number } | null>(null);
```

### 3. `handlePreview` — agora async
- Parsear TODOS os `rawData` (não só 10) para `previewData`
- Coletar todos os nomes únicos do arquivo
- Query no Supabase: `.from('consortium_payments').select('consorciado').in('consorciado', allNames)` — com batches de 200 (padrão do projeto)
- Marcar `isDuplicate: true` nas rows que tiverem match
- Setar `duplicatesReviewed` como `false` quando há duplicados (forçar revisão)

### 4. Painel de duplicados no step Preview (antes do botão Importar)

Se `previewData.some(r => r.isDuplicate)`:

```
┌─────────────────────────────────────────────────────┐
│ ⚠️  X nomes duplicados encontrados                  │
│ Esses registros já existem no banco.                │
│ Revise abaixo e decida o que fazer com cada um.     │
├─────────────────────────────────────────────────────┤
│ Nome                  | Contrato | Status           │
│ João Silva            | 123/456  | [Bloqueado ✓]    │  ← toggle
│ Maria Souza           | 789/012  | [Bloqueado ✓]    │
├─────────────────────────────────────────────────────┤
│ [Bloquear Todos]  [Confirmar Revisão]               │
└─────────────────────────────────────────────────────┘
```

- Toggle individual: muda `allowDuplicate` da row
- "Confirmar Revisão" seta `duplicatesReviewed = true` e libera o botão Importar

### 5. Tabela de Preview

- Mostrar TODOS os registros (ou primeiros 50 com scroll)
- Rows duplicadas: fundo vermelho claro, badge "Duplicado"
- Rows novas: badge "Novo" verde

### 6. `handleImport` — filtrar bloqueados
```ts
const toImport = previewData.filter(r => !r.isDuplicate || r.allowDuplicate);
const blockedCount = previewData.filter(r => r.isDuplicate && !r.allowDuplicate).length;
```
Só insere `toImport`. No final registra `setImportStats({ imported, blocked: blockedCount })`.

### 7. Step "Completo"
Mostrar:
- ✅ X registros importados
- 🚫 Y registros bloqueados por duplicidade de nome

## Resultado

O usuário vê exatamente quais nomes já existem, pode decidir bloquear individualmente ou em massa, e só então confirmar a importação.
