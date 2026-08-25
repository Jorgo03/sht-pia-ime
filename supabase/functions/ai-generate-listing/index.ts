// supabase/functions/ai-generate-listing/index.ts
//
// RETIRED. The AI listing generator ("Gjenero me AI") was removed from the
// property form -- no client code calls this function any more. Stubbed
// rather than deleted: this project's tooling has no function-delete
// operation available, only deploy/get/list, so a 410 is the closest thing
// to "gone" that can be shipped from here. Delete the function for real in
// the Supabase Dashboard (Edge Functions) or via `supabase functions delete
// ai-generate-listing` when convenient.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: 'retired', message: 'ai-generate-listing has been retired.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
