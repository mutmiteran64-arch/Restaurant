# GitHub Pages + Supabase

Cette version utilise uniquement les **Repository Secrets** pour le build Vite.

Dans GitHub :

Settings → Secrets and variables → Actions → **Secrets**

Les deux noms doivent être exactement :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Le workflow de déploiement transmet directement ces deux secrets à `npm run build`.

## Diagnostic

Un workflow manuel supplémentaire est fourni :

Actions → **Diagnose Supabase GitHub Secrets** → Run workflow

Il affiche seulement `PRESENT` ou `MISSING`, jamais les valeurs des secrets.

Si les deux secrets sont réellement dans Repository Secrets mais que le diagnostic affiche `MISSING`, le problème vient alors des paramètres/permissions du dépôt ou du contexte GitHub Actions, et non du code Vite.


## Comptes utilisateur

Pour le nouveau système de comptes, consulte `SUPABASE-ACCOUNT-SETUP.md`. Deux Edge Functions Supabase doivent être déployées après la migration.
