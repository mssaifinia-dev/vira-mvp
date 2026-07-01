"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [isTechnician, setIsTechnician] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const userRes = await supabase.auth.getUser();
    const currentUser = userRes.data.user;
    setUser(currentUser);

    if (!currentUser) return;

    const adminRes = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (adminRes.data) setIsAdmin(true);

    const sellerRes = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (sellerRes.data) setIsSeller(true);

    const techRes = await supabase
      .from('technicians')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (techRes.data) setIsTechnician(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function getDisplayIdentity(email: string) {
    if (!email) return '';
    const match = email.match(/^vira(09[0-9]{9})@gmail\.com$/);
    if (match) {
      return match[1];
    }
    return email;
  }

  function getRoleLabel() {
    if (isAdmin) return 'مدیر';
    if (isSeller) return 'فروشنده';
    if (isTechnician) return 'تکنسین';
    return 'مشتری';
  }

  const tabStyle = {
    color: "white",
    textDecoration: "none",
    fontSize: "14px",
    padding: "8px 16px",
    borderRadius: "8px",
    background: "#1e40af",
    border: "1px solid rgba(255,255,255,0.3)",
    whiteSpace: "nowrap" as const,
    display: "inline-block",
    fontWeight: "normal" as const,
  };

  return (
    <nav style={{backgroundColor: "#1e3a8a", padding: "16px 24px"}} dir="rtl">
      <div style={{maxWidth: "1200px", margin: "0 auto"}}>

        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px"}}>

          <div style={{display:"flex", alignItems:"center", gap:"14px", flexWrap:"wrap"}}>
            <Link href="/" style={{color: "white", fontWeight: "bold", fontSize: "18px", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px"}}>
              <span>🏠</span>
              <span>ویرا</span>
            </Link>

            {user ? (
              <div style={{display:"flex", alignItems:"center", gap:"6px", background:"rgba(255,255,255,0.08)", borderRadius:"20px", padding:"4px 12px"}}>
                <span style={{fontSize:"15px", color:"rgba(255,255,255,0.6)"}}>{getDisplayIdentity(user.email)}</span>
                <span style={{fontSize:"13px", color:"#1e3a8a", background:"#fbbf24", borderRadius:"10px", padding:"2px 8px", fontWeight:"bold"}}>
                  {getRoleLabel()}
                </span>
              </div>
            ) : null}
          </div>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "4px"}}>
            <Image
              src="/icons/navbar-logo.png"
              alt="ویرا"
              width={56}
              height={35}
              style={{objectFit: "contain"}}
              priority
            />
            <Link href="/about" style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: "12px",
              textDecoration: "none",
              background: "rgba(255,255,255,0.1)",
              padding: "2px 10px",
              borderRadius: "10px",
              whiteSpace: "nowrap",
            }}>
              درباره ما
            </Link>
          </div>
       
        </div>

                  <div style={{display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap", alignItems: "center"}}>

          <Link href="/marketplace" style={tabStyle}>فروشگاه</Link>
          <Link href="/cart" style={tabStyle}>سبد خرید</Link>
          <Link href="/technician" style={tabStyle}>درخواست تکنسین</Link>
          <Link href="/support" style={tabStyle}>پشتیبانی</Link>

          {user ? (
            <Link href="/notifications" style={{...tabStyle, position: "relative"}}>
              🔔
            </Link>
          ) : null}

          {user ? (
            <Link href="/my-requests" style={tabStyle}>درخواست‌های من</Link>
          ) : null}

          {!isSeller ? (
            <Link href="/seller/register" style={tabStyle}>فروشنده شو</Link>
          ) : (
            <Link href="/seller/dashboard" style={tabStyle}>داشبورد فروشنده</Link>
          )}

          {isTechnician ? (
            <Link href="/technician/dashboard" style={tabStyle}>داشبورد تکنسین</Link>
          ) : (
            <Link href="/technician/register" style={tabStyle}>ثبت‌نام تکنسین</Link>
          )}

          {isAdmin ? (
            <Link href="/admin" style={tabStyle}>پنل مدیریت</Link>
          ) : null}

          {user ? (
            <button
              onClick={handleLogout}
              style={{background: "#dc2626", color: "white", border: "1px solid #dc2626", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontSize: "14px"}}
            >
              خروج
            </button>
          ) : (
            <Link
              href="/auth"
              style={{background: "#16a34a", color: "white", borderRadius: "8px", padding: "8px 16px", textDecoration: "none", fontWeight: "bold", fontSize: "14px", border: "1px solid #16a34a"}}
            >
              ورود
            </Link>
          )}

        </div>
      </div>
    </nav>
  );
}
