import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Newest first; falls back to the older GPT Image model if the account
// doesn't have access to the default. (DALL-E was retired May 2026.)
const IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey   = Deno.env.get('OPENAI_API_KEY')!;

    // Verify JWT and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const supabase = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { data: roleRow } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });

    const { prompt, game_name, asset_type, asset_key } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400, headers: CORS });

    // Call OpenAI GPT Image. No response_format (GPT image always returns b64_json).
    // Try newest model, fall back to older one only on model-availability errors.
    let openaiData: any = null;
    let lastErr = 'OpenAI error';
    for (const model of IMAGE_MODELS) {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality: 'low' }),
      });
      const d = await r.json();
      if (r.ok) { openaiData = d; break; }
      lastErr = d.error?.message ?? 'OpenAI error';
      // Only fall through to the next model when this one is unavailable;
      // surface real errors (content policy, billing) immediately.
      if (!/does not exist|not have access|must be verified|unsupported model/i.test(lastErr)) {
        throw new Error(lastErr);
      }
    }
    if (!openaiData) throw new Error(lastErr);

    // GPT Image returns b64_json; keep a url fallback just in case
    const item = openaiData.data?.[0];
    let bytes: Uint8Array;
    if (item?.b64_json) {
      bytes = Uint8Array.from(atob(item.b64_json), c => c.charCodeAt(0));
    } else if (item?.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) throw new Error('Failed to download generated image');
      bytes = new Uint8Array(await imgRes.arrayBuffer());
    } else {
      throw new Error('OpenAI returned no image');
    }

    // Upload to Supabase Storage
    const fileName = `${game_name}/${asset_type}/${asset_key}_${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('game-assets')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage.from('game-assets').getPublicUrl(fileName);

    // Insert record into game_assets
    const { data: assetRow } = await supabase.from('game_assets').insert({
      game_name, asset_type, asset_key, url: publicUrl, prompt, is_active: false,
    }).select().single();

    return new Response(JSON.stringify({ url: publicUrl, id: assetRow.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
