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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration is incomplete.' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { email, password, fullName, restaurantName } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string' || typeof restaurantName !== 'string') {
      return json({ error: 'Tous les champs sont obligatoires.' }, 400);
    }
    if (password.length < 6) return json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, 400);
    if (fullName.trim().length < 2) return json({ error: 'Le nom complet est obligatoire.' }, 400);
    if (restaurantName.trim().length < 2) return json({ error: 'Le nom du restaurant est obligatoire.' }, 400);

    const { data: setupAvailable, error: setupError } = await admin.rpc('initial_setup_available');
    if (setupError) return json({ error: setupError.message }, 500);
    if (!setupAvailable) return json({ error: 'Le compte principal existe déjà. Les nouveaux utilisateurs doivent être créés par le propriétaire.' }, 409);

    const normalizedEmail = email.trim().toLowerCase();
    let userId: string;
    let createdHere = false;

    // If an account was previously created by the old public sign-up flow, reuse it
    // and explicitly confirm it on the server. This removes the email-confirmation
    // dependency for the first owner account.
    const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) return json({ error: listError.message }, 500);

    const existingUser = usersPage.users.find(
      (u) => (u.email ?? '').trim().toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata ?? {}),
          full_name: fullName.trim(),
          role: 'owner',
        },
      });
      if (updateError || !updated.user) {
        return json({ error: updateError?.message ?? 'Impossible de confirmer le compte.' }, 400);
      }
      userId = existingUser.id;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: 'owner' },
      });
      if (createError || !created.user) return json({ error: createError?.message ?? 'Impossible de créer le compte.' }, 400);
      userId = created.user.id;
      createdHere = true;
    }

    const { error: bootstrapError } = await admin.rpc('bootstrap_initial_owner', {
      p_user_id: userId,
      p_email: normalizedEmail,
      p_full_name: fullName.trim(),
      p_restaurant_name: restaurantName.trim(),
    });

    if (bootstrapError) {
      if (createdHere) await admin.auth.admin.deleteUser(userId);
      return json({ error: bootstrapError.message }, 409);
    }

    return json({ ok: true, message: 'Compte principal créé et confirmé avec succès.', userId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erreur inattendue.' }, 500);
  }
});
