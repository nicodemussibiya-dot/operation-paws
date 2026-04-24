-- Create a sequence for the PAWS ID suffix
CREATE SEQUENCE IF NOT EXISTS paws_id_seq START 1;

-- Function to generate the unique PAWS Reference ID
-- Format: PAWS-YY-XXXXX (e.g., PAWS-26-00402)
CREATE OR REPLACE FUNCTION generate_paws_ref() 
RETURNS TEXT AS $$
DECLARE
  year_code TEXT;
  seq_num TEXT;
BEGIN
  year_code := to_char(CURRENT_DATE, 'YY');
  seq_num := lpad(nextval('paws_id_seq')::TEXT, 5, '0');
  RETURN 'PAWS-' || year_code || '-' || seq_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically assign the PAWS ID on insert
CREATE OR REPLACE FUNCTION set_paws_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.paws_ref IS NULL THEN
    NEW.paws_ref := generate_paws_ref();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the paws_dogs table
-- Note: This assumes the paws_dogs table exists from migration 001
DROP TRIGGER IF EXISTS tr_set_paws_ref ON public.paws_dogs;
CREATE TRIGGER tr_set_paws_ref
BEFORE INSERT ON public.paws_dogs
FOR EACH ROW
EXECUTE FUNCTION set_paws_ref();

-- Add a unique constraint to ensure no duplicates at the DB level
ALTER TABLE public.paws_dogs ADD CONSTRAINT unique_paws_ref UNIQUE (paws_ref);
