'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string | null;
  stock: number;
};

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    async function fetchProduct() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      setProduct(data);
      setLoading(false);
    }
    fetchProduct();
  }, [id]);

  function goToOrder() {
    window.location.href = '/order/' + id;
  }

  if (loading) return (
    <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <p style={{color:"#1e3a8a", fontSize:"18px"}}>در حال بارگذاری...</p>
    </main>
  );

  if (!product) return (
    <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <p style={{color:"#dc2626", fontSize:"18px"}}>محصول یافت نشد</p>
    </main>
  );

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"900px", margin:"0 auto"}}>

        <a href="/marketplace" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none", display:"inline-block", marginBottom:"20px"}}>
          ← بازگشت به فروشگاه
        </a>

        <div style={{background:"white", borderRadius:"16px", padding:"32px", display:"flex", gap:"32px", flexWrap:"wrap"}}>

          <div style={{flex:"1", minWidth:"280px"}}>
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                style={{width:"100%", borderRadius:"12px", objectFit:"cover", maxHeight:"400px"}}
              />
            ) : (
              <div style={{width:"100%", height:"300px", background:"#f3f4f6", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", color:"#9ca3af", fontSize:"48px"}}>
                📦
              </div>
            )}
          </div>

          <div style={{flex:"1", minWidth:"280px"}}>
            <span style={{background:"#eff6ff", color:"#1e3a8a", fontSize:"12px", padding:"4px 12px", borderRadius:"20px", fontWeight:"bold"}}>
              {product.category}
            </span>

            <h1 style={{fontSize:"28px", fontWeight:"bold", color:"#111827", margin:"16px 0 8px"}}>
              {product.name}
            </h1>

            <p style={{color:"#6b7280", lineHeight:"1.8", marginBottom:"24px"}}>
              {product.description}
            </p>

            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px"}}>
              <span style={{fontSize:"28px", fontWeight:"bold", color:"#16a34a"}}>
                {product.price.toLocaleString('fa-IR')} تومان
              </span>
              <span style={{fontSize:"14px", color: product.stock > 0 ? "#16a34a" : "#dc2626"}}>
                {product.stock > 0 ? "موجودی: " + product.stock : "ناموجود"}
              </span>
            </div>

            <div style={{display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px"}}>
              <span style={{fontSize:"14px", color:"#6b7280"}}>تعداد:</span>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{width:"36px", height:"36px", background:"#f3f4f6", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"18px"}}
              >
                −
              </button>
              <span style={{fontWeight:"bold", fontSize:"16px", minWidth:"24px", textAlign:"center"}}>
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                style={{width:"36px", height:"36px", background:"#f3f4f6", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"18px"}}
              >
                +
              </button>
            </div>

            <button
              onClick={goToOrder}
              disabled={product.stock === 0}
              style={{
                width:"100%",
                background: product.stock === 0 ? "#9ca3af" : "#1e3a8a",
                color:"white",
                padding:"14px",
                borderRadius:"10px",
                border:"none",
                cursor: product.stock === 0 ? "not-allowed" : "pointer",
                fontSize:"16px",
                fontWeight:"bold"
              }}
            >
              {product.stock === 0 ? "ناموجود" : "ثبت سفارش"}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}