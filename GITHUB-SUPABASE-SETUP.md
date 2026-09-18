# Configuration GitHub Actions / Supabase

Le workflow `.github/workflows/deploy.yml` attend :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ils sont lus comme des **GitHub Actions Secrets** au moment du build Vite.

## Où les mettre

Dans GitHub :

`Settings` → `Secrets and variables` → `Actions`

Tu peux les créer comme **Repository secrets**.

Si tu utilises l'environnement `github-pages`, crée-les dans :

`Settings` → `Environments` → `github-pages` → `Environment secrets`

Le workflow utilise maintenant explicitement l'environnement `github-pages` sur le job de build. Il vérifie aussi la présence des deux secrets avant `npm run build`.

## Important

Ne mets jamais la vraie `VITE_SUPABASE_ANON_KEY` dans un fichier `.env` commité dans un dépôt public.

Après avoir ajouté/modifié les secrets, relance le workflow avec :

`Actions` → `Deploy Vite app to GitHub Pages` → `Run workflow`

Si un secret manque, le workflow s'arrêtera avant le build avec un message explicite au lieu de produire une application affichant « Configuration Supabase manquante ».
