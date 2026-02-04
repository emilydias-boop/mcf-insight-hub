
# Plano: Corrigir Permissão de Upload de NFSe para SDRs/Closers

## Problema Identificado

O erro "new row violates row-level security policy" está ocorrendo no **upload do arquivo** para o bucket `user-files`, não na inserção na tabela `rh_nfse`.

### Causa Raiz

A política RLS de INSERT no bucket `user-files` permite apenas:
- Admin
- Manager  
- Coordenador

O Cleiton é **SDR**, portanto não tem permissão para fazer upload de arquivos neste bucket.

### Código que Falha

```tsx
// EnviarNfseFechamentoModal.tsx linha 62-64
const { error: uploadError } = await supabase.storage
  .from('user-files')
  .upload(fileName, file, { upsert: true });
```

O path sendo usado: `${employeeId}/nfse-fechamento-${year}-${month}.pdf`

## Solução

Criar uma nova política RLS no storage que permita colaboradores fazerem upload de seus próprios arquivos de NFSe, validando que o path contém seu `employee_id`.

### Migração SQL

```sql
-- Permitir colaboradores fazerem upload de suas próprias NFSe
CREATE POLICY "Colaboradores podem fazer upload de suas NFSe"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM employees 
    WHERE user_id = auth.uid()
  )
);

-- Permitir colaboradores atualizarem seus próprios arquivos (para upsert funcionar)
CREATE POLICY "Colaboradores podem atualizar suas NFSe"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM employees 
    WHERE user_id = auth.uid()
  )
);
```

### Lógica da Política

A função `storage.foldername(name)` extrai o primeiro segmento do path. Como o código usa:
```
${employeeId}/nfse-fechamento-2026-1.pdf
```

A política verifica se o `employeeId` no path corresponde a um employee vinculado ao `auth.uid()` do usuário logado.

## Resultado Esperado

Após a migração:
- Cleiton (SDR) poderá fazer upload de arquivos em `cc98aaeb-b7ba-4c98-baf7-74a5b9137604/...`
- Outros SDRs/Closers também poderão enviar suas próprias NFSes
- A segurança é mantida: cada usuário só pode fazer upload em sua própria pasta

## Arquivos Afetados

| Arquivo | Modificação |
|---------|-------------|
| `supabase/migrations/xxx.sql` | Adicionar políticas de storage para colaboradores |

## Detalhamento Técnico

### Validação de Segurança

A política é segura porque:
1. O `employee_id` é gerado pelo sistema (vem de `useMyEmployee`)
2. O usuário não pode manipular o path para fazer upload em pastas de outros
3. A verificação `employees.user_id = auth.uid()` garante que o usuário só acessa seu próprio registro

### Alternativa Considerada

Outra opção seria usar um bucket separado `nfse-files`, mas isso adicionaria complexidade desnecessária. A solução de adicionar a política ao bucket existente é mais simples e consistente.
