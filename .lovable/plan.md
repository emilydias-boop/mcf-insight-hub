

## Problema

Atualmente, o arquivo `.xlsx` enviado na página "Leads em Limbo" é processado apenas no navegador do usuário e salvo em `sessionStorage`. Isso significa que:
- Se o usuário recarrega a página ou fecha o navegador, perde tudo
- Outros usuários não conseguem ver o arquivo nem os resultados da comparação

## Solução

Persistir o arquivo no Supabase Storage e salvar os metadados + resultados da comparação no banco de dados, permitindo que todos os usuários com acesso vejam a última planilha carregada e seus resultados.

### 1. Criar tabela `limbo_uploads` no Supabase

Armazena metadados de cada upload e os resultados da comparação serializada.

```sql
CREATE TABLE public.limbo_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  row_count integer DEFAULT 0,
  column_mapping jsonb,
  comparison_results jsonb,  -- resultados da comparação serializados
  status text DEFAULT 'pending' -- pending, compared, expired
);

ALTER TABLE public.limbo_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read limbo_uploads"
  ON public.limbo_uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert limbo_uploads"
  ON public.limbo_uploads FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update limbo_uploads"
  ON public.limbo_uploads FOR UPDATE TO authenticated USING (true);
```

### 2. Upload do arquivo para Supabase Storage

Usar o bucket `csv-imports` (já existe) ou criar `limbo-files`. Ao selecionar o arquivo:
1. Fazer upload para Storage
2. Inserir registro em `limbo_uploads`
3. Processar o XLSX normalmente no client
4. Salvar os resultados da comparação no campo `comparison_results`

### 3. Carregar último upload ao abrir a página

Ao montar o componente:
1. Buscar o último `limbo_uploads` com `status = 'compared'`
2. Se existir, carregar os resultados do `comparison_results` e mostrar direto no step `results`
3. Mostrar info de quem subiu e quando
4. Permitir "Nova Comparação" para substituir

### 4. Modificar `LeadsLimbo.tsx`

- Substituir `sessionStorage` por queries ao Supabase
- Adicionar hook `useLimboUpload` para buscar/salvar uploads
- Mostrar badge com "Última atualização: {data} por {nome}" no topo
- Manter botão "Nova Comparação" para re-upload

### Arquivos a modificar/criar
- **Nova migração SQL**: criar tabela `limbo_uploads` + RLS
- **Novo hook** `src/hooks/useLimboUpload.ts`: fetch último upload, salvar upload + resultados
- **Modificar** `src/pages/crm/LeadsLimbo.tsx`: usar o novo hook em vez de sessionStorage, mostrar info do último upload

### Fluxo do usuário
1. Abre a página → vê os resultados da última comparação (se existir), com info de quem subiu
2. Clica "Nova Comparação" → volta ao step upload
3. Sobe arquivo → arquivo vai pro Storage + banco → processa e salva resultados
4. Outros usuários abrem a mesma página → veem os mesmos resultados

