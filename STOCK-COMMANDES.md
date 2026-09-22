# Liaison professionnelle Commandes ↔ Stock

Le système de caisse utilise maintenant une transaction serveur unique pour encaisser une commande et consommer le stock.

## Principe

- Un produit du menu peut avoir une recette dans **Menu → modifier le produit → Recette / ingrédients**.
- La recette indique la quantité consommée par unité vendue.
- Exemple : `Coca-Cola` → `Coca-Cola (bouteille)` → `1 unité`.
- Si le stock contient 10 bouteilles et qu'une commande contient 1 Coca, le stock passe à 9.
- Si une commande contient 3 Coca, le stock passe à 7.
- Si le stock est insuffisant, la commande est refusée et **aucune partie de la commande ni du paiement n'est enregistrée**.
- Le mouvement est enregistré dans **Stock → Mouvements** avec la cause `sale` et la référence de la commande.
- La caisse affiche aussi le stock disponible pour les produits dont la recette est configurée.

## Pourquoi c'est plus sûr

La consommation n'est plus faite en plusieurs requêtes indépendantes depuis le navigateur. La fonction SQL `checkout_order_with_stock` effectue la vérification du stock, la commande, le paiement et les mouvements de stock dans une même transaction, avec verrouillage des ingrédients concernés.

## Mise en place

Après avoir remplacé le projet, appliquer les migrations :

```bash
supabase db push
```

La nouvelle migration est :

`supabase/migrations/20260921000100_atomic_stock_checkout.sql`

Aucune clé `service_role` n'est nécessaire dans le frontend.

## Important pour les produits

Pour qu'un produit retire réellement du stock, il faut lui définir une recette. Un produit sans recette reste vendable mais son stock ne peut pas être calculé automatiquement.

Exemple professionnel :

- Coca-Cola 33cl → 1 × Coca-Cola 33cl
- Fanta 33cl → 1 × Fanta 33cl
- Poulet braisé → 0,35 kg poulet + 0,20 kg charbon + 0,15 kg huile + etc.
- Burger → 1 pain + 1 steak + 1 tranche fromage + 0,02 kg sauce + etc.

Ainsi le système peut suivre non seulement les boissons, mais aussi les matières premières des plats.

## Architecture stock professionnelle

Le menu et le stock représentent deux choses différentes :

- **Produit du menu** : ce que le client achète et ce qui est affiché au POS.
- **Ingrédient / article de stock** : ce que le restaurant possède physiquement (Coca-Cola, poulet, farine, huile, fromage, etc.).
- **Recette** : la relation entre les deux. Elle définit ce qui est consommé pour une unité vendue.

### Exemple

Si `Coca-Cola` est un produit du menu et que sa recette contient `1 bouteille de Coca-Cola` :

- stock avant vente : 10 bouteilles
- vente : 1 Coca-Cola
- stock après vente : 9 bouteilles

Le POS vérifie le stock disponible avant l'encaissement et la fonction SQL réalise la vente et la consommation du stock dans la même transaction.

### Achats

Créer une commande fournisseur ne modifie pas encore le stock. Le stock augmente uniquement quand la commande est **réceptionnée**. À la réception, le système :

1. ajoute les quantités reçues ;
2. calcule le coût moyen pondéré de l'ingrédient ;
3. crée le mouvement d'entrée ;
4. marque la commande comme reçue ;
5. recalcule le coût des produits du menu qui utilisent cet ingrédient.

### Pertes, casse et inventaire

Les pertes et casses sont enregistrées comme sorties de stock avec une cause précise. L'inventaire physique permet de saisir la quantité réellement comptée ; seul l'écart est enregistré comme ajustement.

### Coût réel d'un produit

Le champ `products.cost` devient le coût calculé à partir de la recette :

`coût produit = somme(quantité de chaque ingrédient × coût unitaire actuel)`

Ainsi, si le prix d'achat du poulet augmente, le coût des plats qui utilisent le poulet est automatiquement recalculé. Cela permet ensuite de suivre la marge réelle et d'identifier les plats dont le coût devient trop élevé.

### Cycle recommandé

`Fournisseur → Commande d'achat → Réception → Stock → Recette → Vente POS → Consommation → Inventaire / Pertes → Coût & marge`


## Pilotage financier et marge

Chaque vente conserve le coût de recette au moment de l'encaissement dans `order_items.unit_cost` et `order_items.cost_total`. Les rapports peuvent ainsi calculer le food cost et la marge historique sans dépendre du prix actuel des ingrédients.

- **Chiffre d'affaires** : ventes encaissées sur la période.
- **Food cost / COGS** : coût des recettes réellement vendues.
- **Marge brute** : chiffre d'affaires - food cost.
- **Dépenses d'exploitation** : dépenses enregistrées dans Finance.
- **Bénéfice net estimé** : marge brute - dépenses d'exploitation.
- **Food cost %** : food cost / chiffre d'affaires.

La fonction SQL `get_financial_summary` fournit ces indicateurs avec le périmètre du restaurant connecté.
