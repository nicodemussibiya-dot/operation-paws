-- Enable RLS on sensitive operational tables
ALTER TABLE public.paws_dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paws_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paws_donations ENABLE ROW LEVEL SECURITY;

-- Note: RLS is now active. 
-- No public policies have been created for these tables, 
-- meaning all 'anon' access is blocked by default. 
-- Only the 'service_role' key and Edge Functions can access them.
