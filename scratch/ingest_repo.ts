import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

const env = await load();
const SUPABASE_URL = env["SUPABASE_URL"] || "";
const SERVICE_ROLE = env["SUPABASE_SERVICE_ROLE_KEY"] || "";
const GEMINI_API_KEY = env["GEMINI_API_KEY"] || env["GOOGLE_API_KEY"] || "";

if (!SUPABASE_URL || !SERVICE_ROLE || !GEMINI_API_KEY) {
  console.error("Missing environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY)");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const filesToIngest = [
  "01_GOVERNANCE.md",
  "DATA_BOUNDARY.md",
  "05_PRIVACY.md",
  "SECURITY.md",
  "OPERATIONAL_PLAYBOOK.md",
  "README.md"
];

async function generateEmbedding(text: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] }
      }),
    }
  );
  const data = await res.json();
  return data.embedding?.values;
}

console.log("🚀 Starting Repo Ingestion for RAG...");

for (const file of filesToIngest) {
  try {
    const content = await Deno.readTextFile(file);
    console.log(`- Ingesting ${file}...`);
    
    // Simple chunking: by paragraph
    const chunks = content.split("\n\n").filter(c => c.trim().length > 50);
    
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      if (embedding) {
        const { error } = await supabase.from("paws_knowledge_chunks").insert({
          source: file,
          content: chunk,
          embedding,
          access_level: "public"
        });
        if (error) console.error(`  Error inserting chunk: ${error.message}`);
      }
    }
  } catch (err) {
    console.warn(`  Skipping ${file}: ${err.message}`);
  }
}

console.log("✅ Ingestion complete. PAWS-OS is now grounded.");
