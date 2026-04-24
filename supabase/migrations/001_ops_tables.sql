-- 001_ops_tables.sql
-- Core tables for Operation PAWS operations.
-- These tables should be private/protected via RLS.

-- Dogs table (Sensitive info)
CREATE TABLE IF NOT EXISTS paws_dogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paws_ref TEXT UNIQUE NOT NULL,
    microchip_number TEXT,
    name TEXT,
    breed TEXT,
    dob DATE,
    owner_name TEXT,
    owner_contact TEXT,
    status TEXT DEFAULT 'lead', -- lead, screened, assessed, accepted, deployed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessment logs
CREATE TABLE IF NOT EXISTS paws_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID REFERENCES paws_dogs(id),
    assessor_name TEXT,
    outcome TEXT,
    notes TEXT,
    assessment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Donation logs (Fiat)
CREATE TABLE IF NOT EXISTS paws_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_name TEXT,
    amount DECIMAL,
    currency TEXT DEFAULT 'ZAR',
    purpose TEXT,
    transaction_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Default policy: Deny all to anon, allow all to service_role/authenticated admins
-- (Add specific admin roles as needed)
