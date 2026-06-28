import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">

      {/* HEADER */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-10">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">

          {/* اگر لوگو عکس داری */}
          {/* <img src="/logo.png" className="w-10 h-10 object-contain" /> */}

          {/* لوگوی متنی حرفه‌ای */}
          <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center text-white font-bold">
            V
          </div>

          <div>
            <h1 className="text-xl font-bold leading-tight">
              Vira
            </h1>
            <p className="text-xs text-slate-500">
              تامین ارتباط ویرا
            </p>
          </div>

        </Link>

      </div>