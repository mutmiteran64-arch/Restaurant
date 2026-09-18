# Configuration Supabase pour GitHub Pages

Le workflow accepte maintenant les valeurs dans **Secrets** ou dans **Variables** GitHub Actions.

## Option recommandée

GitHub → Settings → Secrets and variables → Actions → **Secrets**

Créer :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Si les secrets sont dans l'environnement `github-pages` :

GitHub → Settings → Environments → `github-pages` → **Environment secrets**

Le job `build` utilise bien cet environnement.

## Alternative

Tu peux aussi les mettre dans :

Settings → Secrets and variables → Actions → **Variables**

avec exactement les mêmes noms :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Le workflow utilise le secret en priorité et la variable en secours.

## Pourquoi cette version ?

Le log indiquait que GitHub donnait une valeur vide pour `VITE_SUPABASE_ANON_KEY` au job de build. Cette version permet donc de récupérer la configuration depuis les deux emplacements GitHub possibles et conserve une vérification avant le build.

Aucune clé réelle n'est inscrite dans le code du projet.
