# Offline-First

Cette version ajoute une file IndexedDB et un moteur de synchronisation.

## Important
Les opérations doivent être envoyées via `queueMutation(type, table, payload)` pour être disponibles hors connexion. Les écritures directes Supabase déjà présentes dans les écrans restent compatibles en ligne, mais ne deviennent pas automatiquement hors ligne par magie.

Avant déploiement :
1. Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les secrets GitHub.
2. Appliquer les migrations Supabase du dossier `supabase/migrations`.
3. Ne jamais mettre de clé `service_role` dans le frontend.
4. Tester création, modification, suppression, reconnexion et doublons.
