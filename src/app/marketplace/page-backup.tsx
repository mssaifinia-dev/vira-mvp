'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string | null;
  stock: number;
  created_at: string;
};

const categoryLabels: Record<string, string> = {
  ftth: strings.category_ftth,
  'smart-home': strings.category_smart_home,
  'car-parts': strings.category_car_parts,
  stock: strings.category_stock,
};

function getCategoryLabel(cat: string): string {
  if (categoryLabels[cat]) return categoryLabels[cat];
  return cat;
}

export default function Marketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      setProducts(data || []);
      setLoading(false);
    }
    fetchProducts();
    fetchCartCount();
  }, []);

  async function fetchCartCount() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) return;

    const cartRes = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', user.id);

    const items = cartRes.data || [];
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total = total + items[i].quantity;
    }
    setCartCount(total);
  }

  async function addToCart(productId: string) {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const existingRes = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle();

    const existing = existingRes.data;

    if (existing) {
      await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
    } else {
      await supabase.from('cart_items').insert({ user_id: user.id, product_id: productId, quantity: 1 });
    }

    setAddedId(productId);
    setTimeout(() => setAddedId(null), 1500);
    fetchCartCount();
  }

  const categorySet = new Set<string>();
  for (let i = 0; i < products.length; i++) {
    categorySet.add(products[i].category);
  }
  const categories = Array.from(categorySet);

  let filteredProducts = products.filter(function (p) {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (sortBy === 'price_low') {
    filteredProducts = filteredProducts.slice().sort(function (a, b) { return a.price - b.price; });
  } else if (sortBy === 'price_high') {
    filteredProducts = filteredProducts.slice().sort(function (a, b) { return b.price - a.price; });
  } else {
    filteredProducts = filteredProducts.slice().sort(function (a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-blue-900 text-xl">{strings.loading}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8" dir="rtl">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", maxWidth:"1280px", margin:"0 auto 24px", flexWrap:"wrap", gap:"12px"}}>
        <h1 className="text-3xl font-bold text-blue-900">
          {strings.shop_title}
        </h1>
        <a href="/cart" style={{background:"#1e3a8a", color:"white", padding:"10px 20px", borderRadius:"10px", textDecoration:"none", fontSize:"14px", fontWeight:"bold", position:"relative", display:"inline-block"}}>
          🛒 سبد خرید
          {cartCount > 0 ? (
            <span style={{position:"absolute", top:"-8px", left:"-8px", background:"#dc2626", color:"white", borderRadius:"50%", width:"22px", height:"22px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"bold"}}>
              {cartCount}
            </span>
          ) : null}
        </a>
      </div>

      <div style={{maxWidth:"1280px", margin:"0 auto 24px", background:"white", borderRadius:"12px", padding:"16px", display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"center"}}>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={strings.search_placeholder}
          style={{flex:"1", minWidth:"200px", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px"}}
        >
          <option value="all">{strings.filter_all}</option>
          {categories.map(function (cat) {
            return <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>;
          })}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px"}}
        >
          <option value="newest">{strings.sort_newest}</option>
          <option value="price_low">{strings.sort_price_low}</option>
          <option value="price_high">{strings.sort_price_high}</option>
        </select>

      </div>

      {filteredProducts.length === 0 ? (
        <div style={{maxWidth:"1280px", margin:"0 auto", textAlign:"center", padding:"48px", color:"#9ca3af"}}>
          {strings.no_results}
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-lg p-5">

              {product.image && (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-40 object-cover rounded-lg mb-4"
                />
              )}

              <h2 className="text-xl font-bold text-blue-900">{product.name}</h2>
              <p className="text-gray-600 mt-2 text-sm">{product.description}</p>
              <p className="font-bold mt-4 text-green-700">
                {product.price.toLocaleString('fa-IR')} {strings.toman}
              </p>

              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-400">
                  {strings.stock}: {product.stock}
                </span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {getCategoryLabel(product.category)}
                </span>
              </div>

              <div style={{display:"flex", gap:"8px", marginTop:"16px"}}>
                <button
                  onClick={() => { window.location.href = "/product/" + product.id; }}
                  style={{flex:1, background:"#1e3a8a", color:"white", padding:"8px", borderRadius:"8px", fontSize:"14px", border:"none", cursor:"pointer"}}
                >
                  {strings.view}
                </button>
                <button
                  onClick={() => addToCart(product.id)}
                  style={{
                    flex:1,
                    background: addedId === product.id ? "#16a34a" : "#f59e0b",
                    color:"white",
                    padding:"8px",
                    borderRadius:"8px",
                    fontSize:"14px",
                    border:"none",
                    cursor:"pointer"
                  }}
                >
                  {addedId === product.id ? "✓ افزوده شد" : "افزودن به سبد"}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </main>
  );
}