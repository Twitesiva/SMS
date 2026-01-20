-- FIX: The previous function failed because the 'subjects' table uses 'subject_id' as its primary key, NOT 'id'.
-- This script corrects the function to use 'subject_id' in the WHERE clause.

CREATE OR REPLACE FUNCTION set_max_marks_by_subject()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_code TEXT;
BEGIN
  -- Get subject code
  -- CHANGED: 'WHERE id =' to 'WHERE subject_id ='
  SELECT subject_code
  INTO v_subject_code
  FROM subjects
  WHERE subject_id = NEW.subject_id;

  -- Assign max marks
  IF v_subject_code LIKE '%P' THEN
    NEW.max_marks := 70;
  ELSE
    NEW.max_marks := 100;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger is set correctly
DROP TRIGGER IF EXISTS trg_set_max_marks ON marks;

CREATE TRIGGER trg_set_max_marks
BEFORE INSERT OR UPDATE OF subject_id
ON marks
FOR EACH ROW
EXECUTE FUNCTION set_max_marks_by_subject();
