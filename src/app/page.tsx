import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100" dir="rtl">

      <section style={{background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)", position: "relative", overflow: "hidden", padding: "64px 24px"}}>

        <svg width="100%" height="100%" viewBox="0 0 700 340" style={{position: "absolute", top: 0, left: 0, opacity: 0.5}} aria-hidden="true">
          <line x1="0" y1="55" x2="700" y2="35" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"></line>
          <line x1="0" y1="95" x2="700" y2="85" stroke="rgba(255,255,255,0.1)" strokeWidth="1"></line>
          <line x1="0" y1="280" x2="700" y2="300" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"></line>
          <line x1="0" y1="240" x2="700" y2="260" stroke="rgba(255,255,255,0.1)" strokeWidth="1"></line>
          <circle cx="110" cy="60" r="3" fill="rgba(255,255,255,0.5)"></circle>
          <circle cx="470" cy="45" r="3" fill="rgba(255,255,255,0.5)"></circle>
          <circle cx="250" cy="290" r="3" fill="rgba(255,255,255,0.5)"></circle>
          <circle cx="570" cy="270" r="3" fill="rgba(255,255,255,0.5)"></circle>
        </svg>

        <div style={{position: "absolute", right: "24px", top: "24px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "26px", opacity: 0.5, lineHeight: 1}}>
          <span>💻</span>
          <span>📡</span>
          <span>🧠</span>
        </div>

        <div style={{position: "absolute", right: "80px", bottom: "28px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "24px", opacity: 0.45, lineHeight: 1}}>
          <span>🚗</span>
          <span>🔧</span>
        </div>

        <div style={{position: "absolute", left: "24px", top: "30px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "26px", opacity: 0.5, lineHeight: 1}}>
          <span>💡</span>
          <span>📷</span>
          <span>🛠️</span>
        </div>

        <div style={{position: "absolute", left: "80px", bottom: "26px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "24px", opacity: 0.45, lineHeight: 1}}>
          <span>🧺</span>
          <span>🔌</span>
        </div>

        <div style={{position: "relative", zIndex: 2, textAlign: "center"}}>
          <div style={{width: "200px", height: "200px", background: "rgba(255,255,255,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", border: "0.5px solid rgba(255,255,255,0.2)"}}>
            <Image
              src="/vira-logo.png"
              alt="ویرا"
              width={150}
              height={150}
              style={{objectFit: "contain"}}
            />
          </div>
          <h1 style={{color: "white", fontSize: "60px", fontWeight: "bold", margin: "0 0 8px"}}>تامین ارتباط ویرا</h1>
          <p style={{color: "rgba(255,255,255,0.75)", fontSize: "30px", margin: 0}}>
            فیبر نوری، خودرو، خانه هوشمند و خدمات فنی
          </p>
        </div>

      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-8">

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">فروشگاه تجهیزات</h2>
            <p className="mt-4 text-gray-600">
              مودم فیبر نوری، پچ کورد، پیگتیل، تجهیزات شبکه، دوربین مداربسته و خانه هوشمند
            </p>
            <Link href="/marketplace" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition">
              ورود به فروشگاه
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">درخواست تکنسین</h2>
            <p className="mt-4 text-gray-600">
              ثبت خرابی اینترنت، شبکه، برق و خانه هوشمند و اعزام نزدیک‌ترین تکنسین
            </p>
            <Link href="/technician" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition">
              ثبت درخواست
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">فروشندگان استوک</h2>
            <p className="mt-4 text-gray-600">
              فروش تجهیزات نو و استوک توسط همکاران و فروشندگان سراسر کشور
            </p>
            <Link href="/seller/register" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition">
              مشاهده فروشندگان
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">باشگاه تکنسین‌های ویرا</h2>

            <p className="mt-4 text-gray-600">
              به شبکه متخصصان ویرا بپیوندید، پروژه دریافت کنید و خدمات فنی خود را ارائه دهید
            </p>

            <p className="mt-3 text-sm text-gray-500">
              فیبر نوری، شبکه، دوربین مداربسته، خانه هوشمند،
              برقکاری خانگی، برق صنعتی و تعمیرات لوازم خانگی
            </p>

            <Link href="/technician/register" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition">
              ثبت‌نام تکنسین
            </Link>
          </div>
          
        </div>
      </section>

    </main>
  );
}