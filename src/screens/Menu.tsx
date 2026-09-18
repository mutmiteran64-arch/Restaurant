import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { getProductImageUrl } from '@/lib/supabase';
import type { Product, Category, Ingredient, RecipeItem } from '@/lib/supabase';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  UtensilsCrossed,
  Loader2,
  ChefHat,
  Package,
  TrendingUp,
  ImagePlus,
  Upload,
  AlertCircle,
} from 'lucide-react';

export default function Menu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState<Product | null | 'new'>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<Category | null | 'new'>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [prods, cats, ings] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('ingredients').select('*').order('name'),
    ]);
    setProducts(prods.data ?? []);
    setCategories(cats.data ?? []);
    setIngredients(ings.data ?? []);
    setLoading(false);
  }

  const filteredProducts = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Sans categorie';

  async function toggleAvailable(product: Product) {
    await supabase.from('products').update({ available: !product.available }).eq('id', product.id);
    loadData();
  }

  async function deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id);
    loadData();
  }

  async function deleteCategory(id: string) {
    await supabase.from('categories').delete().eq('id', id);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Menu & Recettes</h1>
          <p className="text-sm text-secondary-500 mt-1">Gerez les produits, categories et recettes d'ingredients</p>
        </div>
        <button
          onClick={() => setShowProductModal('new')}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Ajouter un produit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-secondary-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'products' ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'
          }`}
        >
          Produits ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'categories' ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {activeTab === 'products' && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
              placeholder="Rechercher un produit..."
            />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Produit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Categorie</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Prix</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Cout</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Marge</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Disponible</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {filteredProducts.map((product) => {
                  const margin = product.price - Number(product.cost);
                  const marginPct = product.price > 0 ? (margin / product.price) * 100 : 0;
                  return (
                    <tr key={product.id} className="hover:bg-secondary-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img
                                src={getProductImageUrl(product.image_url) ?? undefined}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  img.style.display = 'none';
                                  const parent = img.parentElement;
                                  if (parent && !parent.querySelector('.img-fallback')) {
                                    const fallback = document.createElement('span');
                                    fallback.className = 'img-fallback text-sm font-bold text-secondary-400';
                                    fallback.textContent = product.name.charAt(0).toUpperCase();
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <UtensilsCrossed className="w-4 h-4 text-secondary-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-secondary-900">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-secondary-400 truncate max-w-xs">{product.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-secondary-100 text-secondary-600">{getCategoryName(product.category_id)}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-secondary-900">{formatCurrency(product.price)}</td>
                      <td className="px-4 py-3 text-right text-sm text-secondary-500">{formatCurrency(Number(product.cost))}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-accent-600" />
                          <span className="text-sm font-medium text-accent-700">{formatCurrency(margin)}</span>
                          <span className="text-xs text-secondary-400">({marginPct.toFixed(0)}%)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAvailable(product)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            product.available ? 'bg-accent-500' : 'bg-secondary-300'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            product.available ? 'translate-x-4' : 'translate-x-1'
                          }`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowProductModal(product)}
                            className="p-1.5 rounded-md text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="p-1.5 rounded-md text-secondary-400 hover:bg-error-50 hover:text-error-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-secondary-400">
                <UtensilsCrossed className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Aucun produit trouve</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCategoryModal('new')} className="btn-secondary">
              <Plus className="w-4 h-4" />
              Ajouter une categorie
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              return (
                <div key={cat.id} className="card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-secondary-900">{cat.name}</p>
                        <p className="text-xs text-secondary-400">{count} produits</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowCategoryModal(cat)}
                        className="p-1.5 rounded-md text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="p-1.5 rounded-md text-secondary-400 hover:bg-error-50 hover:text-error-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showProductModal && (
        <ProductModal
          product={showProductModal === 'new' ? null : showProductModal}
          categories={categories}
          ingredients={ingredients}
          onClose={() => setShowProductModal(null)}
          onSaved={() => {
            setShowProductModal(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  categories,
  ingredients,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  ingredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? 0,
    cost: product?.cost ?? 0,
    category_id: product?.category_id ?? '',
    available: product?.available ?? true,
  });
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [recipeQty, setRecipeQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      supabase.from('recipe_items').select('*').eq('product_id', product.id).then(({ data }) => {
        setRecipes(data ?? []);
      });
    }
  }, [product]);

  async function handleImageUpload(file: File) {
    setUploading(true);
    setUploadError(null);

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Le fichier est trop volumineux (5 Mo max)');
      setUploading(false);
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExt)) {
      setUploadError('Format non supporte (JPG, PNG, WEBP, GIF)');
      setUploading(false);
      return;
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const { error: upErr } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (upErr) {
      setUploadError(`Erreur d'upload: ${upErr.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    setImageUrl(urlData.publicUrl);
    setUploadError(null);
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    if (!form.name.trim()) {
      setSaveError('Le nom du produit est obligatoire');
      setSaving(false);
      return;
    }
    if (form.price < 0) {
      setSaveError('Le prix ne peut pas etre negatif');
      setSaving(false);
      return;
    }

    const productData = {
      name: form.name.trim(),
      description: form.description || null,
      price: form.price,
      cost: form.cost,
      category_id: form.category_id || null,
      available: form.available,
      image_url: imageUrl,
    };

    let productId = product?.id;

    try {
      if (product) {
        const { error: updErr } = await supabase.from('products').update(productData).eq('id', product.id);
        if (updErr) throw updErr;
      } else {
        const { data, error: insErr } = await supabase.from('products').insert(productData).select().single();
        if (insErr) throw insErr;
        productId = data?.id;
      }

      if (productId && recipes.length > 0) {
        const { error: delErr } = await supabase.from('recipe_items').delete().eq('product_id', productId);
        if (delErr) throw delErr;
        const { error: recErr } = await supabase.from('recipe_items').insert(
          recipes.map((r) => ({
            product_id: productId,
            ingredient_id: r.ingredient_id,
            quantity: r.quantity,
          }))
        );
        if (recErr) throw recErr;
      }

      setSaving(false);
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
      setSaving(false);
    }
  }

  function addRecipeIngredient() {
    if (!selectedIngredient) return;
    const ing = ingredients.find((i) => i.id === selectedIngredient);
    if (!ing) return;
    setRecipes([...recipes, { id: '', product_id: product?.id ?? '', ingredient_id: ing.id, quantity: recipeQty, created_at: '' }]);
    setSelectedIngredient('');
    setRecipeQty(1);
  }

  function removeRecipeIngredient(ingredientId: string) {
    setRecipes(recipes.filter((r) => r.ingredient_id !== ingredientId));
  }

  const computedCost = recipes.reduce((s, r) => {
    const ing = ingredients.find((i) => i.id === r.ingredient_id);
    return s + (ing ? ing.cost_per_unit * r.quantity : 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4 overflow-y-auto">
      <div className="card p-6 max-w-lg w-full animate-slide-up my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">
            {product ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Photo upload */}
          <div>
            <label className="label">Photo du produit</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg bg-secondary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {imageUrl ? (
                  <img
                    src={getProductImageUrl(imageUrl) ?? undefined}
                    alt="Apercu"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector('.img-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'img-fallback w-full h-full flex items-center justify-center';
                        const icon = document.createElement('span');
                        icon.className = 'text-secondary-300';
                        icon.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                        fallback.appendChild(icon);
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <ImagePlus className="w-8 h-8 text-secondary-300" />
                )}
              </div>
              <div className="flex-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 text-sm font-medium hover:bg-secondary-200 transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Televersement...' : 'Choisir une photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />
                </label>
                {imageUrl && (
                  <button
                    onClick={() => setImageUrl(null)}
                    className="ml-2 text-xs text-error-600 hover:underline"
                  >
                    Retirer la photo
                  </button>
                )}
              </div>
            </div>
            {uploadError && (
              <p className="text-xs text-error-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {uploadError}
              </p>
            )}
          </div>

          <div>
            <label className="label">Nom</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Margherita Pizza"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              rows={2}
              placeholder="Fresh basil, mozzarella, tomato sauce..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prix (USD)</label>
              <input
                type="number"
                step="0.01"
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Cout (USD)</label>
              <input
                type="number"
                step="0.01"
                value={form.cost || ''}
                onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Categorie</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="input"
            >
              <option value="">Sans categorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Recipe section */}
          <div className="border-t border-secondary-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-4 h-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-secondary-700">Recette / Ingredients</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                className="input flex-1"
              >
                <option value="">Choisir un ingredient...</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={recipeQty || ''}
                onChange={(e) => setRecipeQty(Number(e.target.value))}
                className="input w-20"
                placeholder="Qte"
              />
              <button onClick={addRecipeIngredient} className="btn-secondary">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {recipes.length > 0 && (
              <div className="space-y-2">
                {recipes.map((r) => {
                  const ing = ingredients.find((i) => i.id === r.ingredient_id);
                  return (
                    <div key={r.ingredient_id} className="flex items-center justify-between p-2 rounded-lg bg-secondary-50">
                      <span className="text-sm text-secondary-700">{ing?.name ?? 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-secondary-500">{r.quantity} {ing?.unit}</span>
                        <button
                          onClick={() => removeRecipeIngredient(r.ingredient_id)}
                          className="text-error-500 hover:text-error-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary-50">
                  <span className="text-sm font-medium text-primary-700">Cout calcule</span>
                  <span className="text-sm font-bold text-primary-700">{formatCurrency(computedCost)}</span>
                </div>
              </div>
            )}
          </div>

          {saveError && (
            <div className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </div>
          )}

          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {product ? 'Enregistrer' : 'Creer le produit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (category) {
        const { error } = await supabase
          .from('categories')
          .update({ name: name.trim(), icon: icon || null })
          .eq('id', category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({ name: name.trim(), icon: icon || null, sort_order: 0 });
        if (error) throw error;
      }
      setSaving(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
      <div className="card p-6 max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">
            {category ? 'Modifier la categorie' : 'Nouvelle categorie'}
          </h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Entrees, Plats, Boissons..."
            />
          </div>
          {error && (
            <div className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {category ? 'Enregistrer' : 'Creer la categorie'}
          </button>
        </div>
      </div>
    </div>
  );
}
