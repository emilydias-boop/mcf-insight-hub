

# Plano: Cadastrar SDRs Ithaline e Ygor no Consórcio

## Diagnóstico Atual

### Ithaline Clara dos Santos
| Item | Status | Detalhe |
|------|--------|---------|
| Conta de acesso (`profiles`) | ✅ OK | email: `ithaline.clara@minhacasafinanciada.com`, squad: `['consorcio']` |
| Permissão (`user_roles`) | ✅ OK | role: `sdr` |
| Ficha RH (`employees`) | ✅ OK | cargo: SDR, departamento: BU - Consórcio |
| Cadastro fechamento (`sdr`) | ❌ Faltando | Não existe registro na tabela `sdr` |
| Vínculo employee→sdr | ❌ Faltando | `employees.sdr_id = null` |

### Ygor
| Item | Status | Detalhe |
|------|--------|---------|
| Conta de acesso (`profiles`) | ❌ Faltando | Não existe |
| Permissão (`user_roles`) | ❌ Faltando | Não existe |
| Ficha RH (`employees`) | ❌ Faltando | Não existe |
| Cadastro fechamento (`sdr`) | ❌ Faltando | Não existe |

### Cleiton Lima (Referência - Funcionando)
| Item | Status |
|------|--------|
| Conta de acesso | ✅ `cleiton.lima@minhacasafinanciada.com` |
| Permissão | ✅ role: `sdr` |
| Ficha RH | ✅ cargo: SDR, `sdr_id` vinculado |
| Cadastro fechamento | ✅ squad: `consorcio` |

---

## O que precisa ser feito

### Para Ithaline (já tem acesso ao sistema)

**Ação 1**: Cadastrar na tabela `sdr` com squad = 'consorcio'

Isso pode ser feito pela interface existente em `/fechamento-sdr/configuracoes` (aba SDRs → botão "Novo SDR"), preenchendo:
- Nome: Ithaline Clara dos Santos
- Email: `ithaline.clara@minhacasafinanciada.com`
- Usuário vinculado: selecionar o email dela
- Squad: `consorcio` (precisamos adicionar este campo no formulário)

**Ação 2**: Vincular o `sdr_id` no registro de employee dela

---

### Para Ygor (não tem conta ainda)

**Passo 1**: Criar conta de usuário
- Opção A: Convite via Auth do Supabase (requer email do Ygor)
- Opção B: Cadastro manual se ele for acessar pela primeira vez

**Passo 2**: Configurar profile com squad = ['consorcio']

**Passo 3**: Adicionar role `sdr` em user_roles

**Passo 4**: Criar ficha em employees (RH → Colaboradores → Novo Colaborador)

**Passo 5**: Cadastrar na tabela sdr com squad = 'consorcio'

---

## Solução Técnica Recomendada

### Problema identificado no formulário de SDR

O formulário atual de cadastro de SDR (`SdrFormDialog`) não permite selecionar a **squad/BU** do SDR. Isso precisa ser corrigido para que SDRs do Consórcio sejam cadastrados corretamente.

### Alterações necessárias

**Arquivo**: `src/pages/fechamento-sdr/Configuracoes.tsx`

Adicionar campo `squad` no `SdrFormDialog`:

```typescript
// Adicionar estado
const [squad, setSquad] = useState<string>('incorporador');

// No formulário, adicionar select
<div className="space-y-2">
  <Label>Business Unit (Squad)</Label>
  <Select value={squad} onValueChange={setSquad}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="incorporador">Incorporador</SelectItem>
      <SelectItem value="consorcio">Consórcio</SelectItem>
      <SelectItem value="credito">Crédito</SelectItem>
      <SelectItem value="projetos">Projetos</SelectItem>
      <SelectItem value="leilao">Leilão</SelectItem>
    </SelectContent>
  </Select>
</div>

// No submit, incluir squad
await createSdr.mutateAsync({
  name: name.trim(),
  email: email.trim() || null,
  user_id: userId || null,
  nivel: Number(nivel),
  meta_diaria: Number(metaDiaria),
  active,
  squad, // ← Adicionar
});
```

### Vínculo automático com Employee

Atualmente o vínculo `employees.sdr_id` precisa ser feito manualmente. Podemos melhorar o fluxo para que, ao criar um SDR vinculado a um `user_id`, o sistema automaticamente:
1. Busque o employee com esse `user_id`
2. Atualize o `sdr_id` no employee

---

## Resumo de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/fechamento-sdr/Configuracoes.tsx` | Modificar | Adicionar campo `squad` no SdrFormDialog |
| `src/hooks/useSdrFechamento.ts` | Modificar | Atualizar `useCreateSdr` para vincular employee automaticamente |

---

## Passos para o Usuário (Manual)

### Cadastrar Ithaline como SDR do Consórcio

1. Ir em `/fechamento-sdr/configuracoes`
2. Na aba "SDRs", clicar "Novo SDR"
3. Preencher:
   - Nome: `Ithaline Clara dos Santos`
   - Email: `ithaline.clara@minhacasafinanciada.com`
   - Usuário vinculado: selecionar o email dela
   - Squad: `consorcio` (após a correção do formulário)
4. Salvar

### Para Ygor

Primeiro preciso saber:
- Qual é o email completo do Ygor?
- Ele já tem conta no sistema? (pode fazer login?)

---

## Resultado Esperado

Após as alterações:

1. **Página de Fechamento do Consórcio** (`/consorcio/fechamento`) na aba SDRs mostrará:
   - Cleiton Lima
   - Ithaline Clara dos Santos
   - Ygor (após cadastro completo)

2. **Cada SDR poderá**:
   - Ver seu próprio fechamento
   - Acessar a agenda do consórcio
   - Ver negócios da BU Consórcio
   - Agendar reuniões para os closers do consórcio

