import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100" dir="rtl">

      <section className="bg-blue-900 text-white py-20 text-center px-4">
        <Image
          src="/vira-logo.png"
          alt="لوگو ویرا"
          width={120}
          height={120}
          className="mx-auto mb-6 object-contain"
        />
        <h1 className="text-4xl font-bold">تامین ارتباط ویرا</h1>
        <p className="mt-4 text-blue-200 text-lg">
          فروش تجهیزات FTTH، خانه هوشمند، شبکه و خدمات فنی
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">

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

        </div>
      </section>

    </main>
  );
}