-- ==========================================
-- OPERATION PAWS: MASTER SCHEMA (Strategic Command Update)
-- ==========================================

-- 1. CORE DOG DATA (Enhanced for Commissioner/Insurance)
CREATE TABLE IF NOT EXISTS public.paws_dogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paws_ref TEXT UNIQUE, 
    microchip_id TEXT UNIQUE NOT NULL,
    dog_name TEXT NOT NULL,
    breed TEXT,
    dog_image TEXT, -- candidate photo
    intake_date DATE DEFAULT CURRENT_DATE,
    source_tier INTEGER CHECK (source_tier IN (1, 2, 3)),
    
    -- Strategic Fields
    status TEXT DEFAULT 'Screening' CHECK (status IN (
      'Screening', 'Academy', 'Commissioner_Pending', 
      'SAPS_Accepted', 'Withdrawn', 'Welfare_Veto', 'Rejected'
    )),
    assigned_job TEXT CHECK (assigned_job IN (
      'Patrol_Tracker', 'Narcotics', 'Explosives', 
      'Search_Rescue', 'Protected_Species', 'Biological_Fluid'
    )),
    risk_level TEXT DEFAULT 'Medium' CHECK (risk_level IN ('Low', 'Medium', 'High')),
    insurance_status TEXT DEFAULT 'Pending' CHECK (insurance_status IN ('Pending', 'Covered', 'Claim_Active', 'Expired')),
    uniform_status TEXT DEFAULT 'Pending' CHECK (uniform_status IN ('Pending', 'Tailoring', 'Issued')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ACADEMY PROGRESS LOGS
CREATE TABLE IF NOT EXISTS public.paws_academy_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID REFERENCES public.paws_dogs(id) ON DELETE CASCADE,
    week_number INTEGER,
    aptitude_score INTEGER CHECK (aptitude_score BETWEEN 0 AND 100),
    instructor_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INSURANCE PARTNERS
CREATE TABLE IF NOT EXISTS public.paws_insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID REFERENCES public.paws_dogs(id) ON DELETE CASCADE,
    policy_number TEXT UNIQUE,
    provider_name TEXT NOT NULL, -- e.g., Hollard, Outsurance, etc.
    premium_status TEXT DEFAULT 'Active',
    coverage_start DATE,
    coverage_end DATE
);

-- (Keep the same Trigger and Function logic from previous version for PAWS-ID)
-- ... [PAWS-ID Sequence Logic here] ...
