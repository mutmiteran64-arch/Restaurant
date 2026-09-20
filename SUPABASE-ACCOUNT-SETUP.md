# Nouveau modèle de comptes RestoFlow

Cette version met en place le modèle suivant :

1. **Première page :** seul le premier compte principal peut être créé.
2. Le premier compte devient automatiquement **owner** du restaurant.
3. Après cette création, la page publique affiche uniquement la connexion.
4. **Personnel → Ajouter un utilisateur** est réservé au propriétaire.
5. Les comptes employés sont créés côté serveur par une Supabase Edge Function.
6. La `service_role` n'est jamais envoyée au navigateur.

## À appliquer dans Supabase

La migration à appliquer est :

`supabase/migrations/20260920000100_account_creation_model.sql`

Puis déployer les deux Edge Functions :

```bash
supabase functions deploy bootstrap-owner --no-verify-jwt
supabase functions deploy create-staff-user
```

Le projet Supabase doit avoir les secrets système habituels pour les Edge Functions (`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase).

## Première installation

Après migration + déploiement des fonctions :

- ouvrir l'application ;
- la page propose **Créer le compte principal** ;
- saisir le nom du restaurant, le nom du propriétaire, l'email et le mot de passe ;
- le compte est créé directement comme `owner` et rattaché au restaurant.

Après cette étape, un autre visiteur ne voit plus l'inscription publique.

## Création d'un employé

Le propriétaire ouvre :

`Personnel → Ajouter un utilisateur`

Il choisit :

- nom complet ;
- email ;
- téléphone facultatif ;
- rôle ;
- mot de passe temporaire.

Les rôles disponibles sont :

- Manager
- Caissier
- Serveur
- Chef
- Magasinier
- Comptable

Le compte est automatiquement rattaché au `tenant_id` du propriétaire.

## Important

Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY` dans Vite, GitHub Pages, `.env` public ou le navigateur.
