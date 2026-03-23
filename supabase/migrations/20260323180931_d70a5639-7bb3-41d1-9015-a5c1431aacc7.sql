ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_profile_id_fkey;
ALTER TABLE employees ADD CONSTRAINT employees_profile_id_fkey 
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_user_id_fkey;
ALTER TABLE employees ADD CONSTRAINT employees_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_user_id_fkey;
ALTER TABLE calls ADD CONSTRAINT calls_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE bu_strategic_documents DROP CONSTRAINT IF EXISTS bu_strategic_documents_uploaded_by_fkey;
ALTER TABLE bu_strategic_documents ADD CONSTRAINT bu_strategic_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE attendee_movement_logs DROP CONSTRAINT IF EXISTS attendee_movement_logs_moved_by_fkey;
ALTER TABLE attendee_movement_logs ADD CONSTRAINT attendee_movement_logs_moved_by_fkey
  FOREIGN KEY (moved_by) REFERENCES profiles(id) ON DELETE SET NULL;