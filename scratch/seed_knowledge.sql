-- Seed data for knowledge base (Mock embeddings for demo purpose)
-- In a real setup, these would be generated via a script calling the embedding API.
-- For the demo, we insert text and dummy vectors or expect the user to run a real seeding script.

INSERT INTO paws_knowledge_chunks (source, content, embedding, access_level)
VALUES 
('01_GOVERNANCE.md', 'Operation PAWS follows a multi-tier governance model. Presidency Oversight is read-only and focuses on national risk.', array_fill(0, ARRAY[768])::vector, 'public'),
('DATA_BOUNDARY.md', 'The system operates on an "Open Recipe, Locked Kitchen" model. All PII is isolated from the internet.', array_fill(0, ARRAY[768])::vector, 'public'),
('SECURITY.md', 'All high-risk actions require 2FA verification via the paws-secure-action edge function.', array_fill(0, ARRAY[768])::vector, 'public'),
('OPERATIONAL_PLAYBOOK.md', 'Restricted SOP for K9 handlers: Ensure dog welfare is priority #1 during deployment.', array_fill(0, ARRAY[768])::vector, 'restricted');
