-- Add 'financeiro' to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'financeiro' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'financeiro';
  END IF;
END $$;

-- Add 'financeiro' to resource_type enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'financeiro' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resource_type')) THEN
    ALTER TYPE resource_type ADD VALUE 'financeiro';
  END IF;
END $$;