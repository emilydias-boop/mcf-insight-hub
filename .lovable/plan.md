

# Fix: "new row violates row-level security policy" on Strategic Documents

## Root Cause

The RLS policies created for `bu_strategic_documents` table and `bu-strategic-documents` storage bucket check roles via `auth.users.raw_app_meta_data -> 'roles'`, but this project stores roles in the `user_roles` table. The `raw_app_meta_data` field is empty for all users, so every policy check fails.

## Solution

Replace all RLS policies on both the table and storage bucket to use the existing `public.has_role(auth.uid(), role)` security definer function, which correctly queries the `user_roles` table.

## Database Migration

### 1. Drop and recreate policies on `bu_strategic_documents`

- **INSERT policy**: Use `has_role()` to check for admin, manager, or coordenador
- **SELECT policy**: Admin/manager see all; coordenador sees only their BU (using `profiles.squad`)
- **DELETE policy**: Owner can delete their own, admin/manager can delete any

### 2. Drop and recreate storage policies on `bu-strategic-documents` bucket

- **INSERT (upload)**: `has_role()` check for admin/manager/coordenador
- **SELECT (view)**: `has_role()` check for admin/manager/coordenador
- **DELETE**: `has_role()` check for admin/manager + owner check

## Technical Details

SQL migration will:

```text
-- Drop existing broken policies
DROP POLICY "coordenador_plus_insert_strategic_docs" ON public.bu_strategic_documents;
DROP POLICY "coordenador_plus_select_strategic_docs" ON public.bu_strategic_documents;
DROP POLICY "owner_or_admin_delete_strategic_docs" ON public.bu_strategic_documents;

-- Recreate using has_role()
CREATE POLICY "insert_strategic_docs" ON public.bu_strategic_documents
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'coordenador')
);

CREATE POLICY "select_strategic_docs" ON public.bu_strategic_documents
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  (has_role(auth.uid(), 'coordenador') AND bu = ANY(
    SELECT unnest(squad) FROM profiles WHERE id = auth.uid()
  ))
);

CREATE POLICY "delete_strategic_docs" ON public.bu_strategic_documents
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid() OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager')
);

-- Same pattern for storage.objects policies on bucket 'bu-strategic-documents'
DROP POLICY "coordenador_plus_upload_strategic_docs" ON storage.objects;
DROP POLICY "coordenador_plus_view_strategic_docs" ON storage.objects;
DROP POLICY "owner_or_admin_delete_strategic_docs_storage" ON storage.objects;

CREATE POLICY "upload_strategic_docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bu-strategic-documents' AND (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'coordenador')
  )
);

CREATE POLICY "view_strategic_docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'bu-strategic-documents' AND (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'coordenador')
  )
);

CREATE POLICY "delete_strategic_docs_storage" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'bu-strategic-documents' AND (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager')
  )
);
```

No code changes needed -- only the database policies need to be fixed.

