-- /scratch/seed_massive_data.sql
-- Seeds the database with 500 tactical K9s and R12.8M in mock financials.

-- 1. Seed Financials
INSERT INTO public.paws_escrow (sponsor_name, amount_zar, purpose) VALUES
('Standard Bank', 5000000.00, 'Tier 1 Acquisition & Deployment'),
('Hollard Insurance', 3000000.00, 'National K9 Risk Offset Pool'),
('CSIR South Africa', 2800000.00, 'Tactical R&D and Ballistic Gear'),
('Anonymous Donor', 2000000.00, 'Breeder League Prize Pool');

-- 2. Seed 500 Dogs (Simulation Loop)
DO $$
DECLARE
    i INT := 1;
    dog_status TEXT;
    tier TEXT;
    breed TEXT;
    breeds TEXT[] := ARRAY['German Shepherd', 'Malinois', 'Rottweiler', 'Labrador', 'Border Collie'];
    breeders TEXT[] := ARRAY['K9 Bloodlines RSA', 'Zulu Tactical', 'Soweto Youth Club', 'Cape Hub Breeders'];
BEGIN
    FOR i IN 1..500 LOOP
        -- Randomize Status
        IF i % 10 = 0 THEN dog_status := 'pending_commissioner';
        ELSIF i % 3 = 0 THEN dog_status := 'approved';
        ELSE dog_status := 'training';
        END IF;

        -- Randomize Tier
        IF i % 5 = 0 THEN tier := 'T1';
        ELSIF i % 3 = 0 THEN tier := 'T2';
        ELSE tier := 'T3';
        END IF;

        -- Randomize Breed
        breed := breeds[(i % 5) + 1];

        INSERT INTO public.paws_dogs (
            paws_ref, 
            name, 
            breed, 
            microchip_number, 
            status, 
            source_tier,
            photo_urls
        ) VALUES (
            'PAWS-2026-' || LPAD(i::text, 5, '0'),
            'Tactical-Asset-' || i,
            breed,
            '900' || LPAD(i::text, 12, '0'),
            dog_status,
            tier,
            ARRAY['https://placedog.net/900/600?id=' || i]
        );
    END LOOP;
END $$;
