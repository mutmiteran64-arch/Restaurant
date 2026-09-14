# Offline-First

Cette version ajoute une file IndexedDB et un moteur de synchronisation.

## Important
Les opérations doivent être envoyées via `queueMutation(type, table, payload)` pour être disponibles hors connexion. Les écritures directes Supabase déjà présentes dans les écrans restent compatibles en ligne, mais ne deviennent pas automatiquement hors ligne par magie.

Avant déploiement :
1. Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les secrets GitHub.
2. Appliquer les migrations Supabase du dossier `supabase/migrations`.
3. Ne jamais mettre de clé `service_role` dans le frontend.
4. Tester création, modification, suppression, reconnexion et doublons.

## Multi-tenant
La migration `20260914000200_multi_tenant.sql` crée `tenants` et `tenant_members`, ajoute `tenant_id` aux tables métier, applique les politiques RLS par tenant et fournit `create_tenant_for_current_user()`. Chaque cache Offline-First doit utiliser une clé préfixée par le `tenant_id`; ne jamais mélanger les données de deux restaurants dans le même navigateur.
