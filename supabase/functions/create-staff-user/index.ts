import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const roles = new Set(['manager', 'cashier', 'server', 'chef', 'storekeeper', 'accountant']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration is incomplete.' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentification requise.' }, 401);

  try {
    const jwt = authHeader.slice('Bearer '.length);
    const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
    if (callerError || !callerData.user) return json({ error: 'Session invalide.' }, 401);

    const { data: caller, error: callerProfileError } = await admin
      .from('profiles')
      .select('id, tenant_id, role, active')
      .eq('id', callerData.user.id)
      .maybeSingle();

    if (callerProfileError || !caller || caller.role !== 'owner' || !caller.active || !caller.tenant_id) {
      return json({ error: 'Seul le propriétaire actif peut créer des utilisateurs.' }, 403);
    }

    const { email, password, fullName, phone, role } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string' || typeof role !== 'string') {
      return json({ error: 'Email, nom, rôle et mot de passe sont obligatoires.' }, 400);
    }
    if (!roles.has(role)) return json({ error: 'Rôle utilisateur invalide.' }, 400);
    if (password.length < 6) return json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, 400);

    const normalizedEmail = email.trim().toLowerCase();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim(), role },
    });
    if (createError || !created.user) return json({ error: createError?.message ?? 'Impossible de créer le compte utilisateur.' }, 400);

    const userId = created.user.id;
    const { error: memberError } = await admin.from('tenant_members').insert({
      tenant_id: caller.tenant_id,
      user_id: userId,
      role,
      active: true,
    });
    if (memberError) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: memberError.message }, 400);
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      email: normalizedEmail,
      full_name: fullName.trim(),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      role,
      tenant_id: caller.tenant_id,
      active: true,
    });
    if (profileError) {
      await admin.from('tenant_members').delete().eq('tenant_id', caller.tenant_id).eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: profileError.message }, 400);
    }

    return json({ ok: true, userId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erreur inattendue.' }, 500);
  }
});
