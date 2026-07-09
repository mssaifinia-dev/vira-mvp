'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // برای حالت پیامکی
  const [otpPhone, setOtpPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);


  function isPhoneNumber(val: string) {
    return /^09[0-9]{9}$/.test(val);
  }


  function isEmail(val: string) {
    return val.indexOf('@') !== -1;
  }


  function handleIdentifierChange(val: string) {

    if (isEmail(val)) {
      setIdentifier(val);
    } else {

      const cleaned =
        val.replace(/[^0-9]/g, '').substring(0, 11);

      setIdentifier(cleaned);

    }

  }


  function toLoginEmail(val: string) {

    if (isEmail(val)) {
      return val;
    }

    return 'vira' + val + '@gmail.com';

  }



  async function handleSubmit() {

    setLoading(true);
    setError(null);
    setMessage(null);


    if (!identifier) {

      setError('شماره موبایل یا ایمیل را وارد کنید');
      setLoading(false);
      return;

    }


    if (!isEmail(identifier) && !isPhoneNumber(identifier)) {

      setError('شماره موبایل باید 11 رقم و با 09 شروع شود');
      setLoading(false);
      return;

    }


    if (password.length < 6) {

      setError('رمز عبور باید حداقل 6 کاراکتر باشد');
      setLoading(false);
      return;

    }


    const loginEmail = toLoginEmail(identifier);



    if (isLogin) {


      const loginRes =
        await supabase.auth.signInWithPassword({

          email: loginEmail,
          password: password,

        });



      if (loginRes.error) {

        setError('شماره موبایل/ایمیل یا رمز عبور اشتباه است');

      } else {

        window.location.href = '/';

      }


    } else {


      const signUpRes =
        await supabase.auth.signUp({

          email: loginEmail,
          password: password,

        });



      if (signUpRes.error) {

        setError(
          'خطا در ثبت‌نام: ' + signUpRes.error.message
        );


      } else {


        const signInRes =
          await supabase.auth.signInWithPassword({

            email: loginEmail,
            password: password,

          });



        if (!signInRes.error) {

          window.location.href = '/';

        } else {

          setMessage(
            'ثبت‌نام انجام شد! حالا وارد شوید.'
          );

          setIsLogin(true);

        }

      }

    }


    setLoading(false);

  }



  function handleFormSubmit(e: React.FormEvent) {

    e.preventDefault();
    handleSubmit();

  }


  function handleOtpPhoneChange(val: string) {
    const cleaned = val.replace(/[^0-9]/g, '').substring(0, 11);
    setOtpPhone(cleaned);
  }


  async function sendOtp() {
    setError(null);
    setMessage(null);

    if (!isPhoneNumber(otpPhone)) {
      setError('شماره موبایل باید 11 رقم و با 09 شروع شود');
      return;
    }

    setOtpLoading(true);

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setOtpSent(true);
        setMessage('کد ۶ رقمی برای شما پیامک شد');
      }
    } catch (e) {
      setError('خطا در ارسال کد. دوباره تلاش کنید');
    }

    setOtpLoading(false);
  }


  async function verifyOtp() {
    setError(null);
    setMessage(null);

    if (otpCode.length !== 6) {
      setError('کد باید ۶ رقم باشد');
      return;
    }

    setOtpLoading(true);

    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, code: otpCode }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setOtpLoading(false);
        return;
      }

      const loginRes = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (loginRes.error) {
        setError('خطا در ورود. دوباره تلاش کنید');
        setOtpLoading(false);
        return;
      }

      window.location.href = '/';

    } catch (e) {
      setError('خطا در تایید کد. دوباره تلاش کنید');
      setOtpLoading(false);
    }
  }


  return (
    
    <main
      className="min-h-screen bg-gray-100 flex items-center justify-center"
      dir="rtl"
    >

      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">


        <h1 className="text-2xl font-bold text-blue-900 text-center mb-6">

          {mode === 'password' ? (isLogin ? 'ورود به ویرا' : 'ثبت‌نام در ویرا') : 'ورود با کد پیامکی'}

        </h1>


        <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => { setMode('password'); setError(null); setMessage(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === 'password' ? 'bg-blue-900 text-white' : 'text-gray-600'}`}
          >
            رمز عبور
          </button>
          <button
            type="button"
            onClick={() => { setMode('otp'); setError(null); setMessage(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === 'otp' ? 'bg-blue-900 text-white' : 'text-gray-600'}`}
          >
            کد پیامکی
          </button>
        </div>


        {mode === 'password' ? (

        <form
          onSubmit={handleFormSubmit}
          className="space-y-4"
        >


          <div>

            <label className="block text-sm text-gray-600 mb-1">

              شماره موبایل یا ایمیل

            </label>


            <input
              type="text"
              value={identifier}
              onChange={(e)=>handleIdentifierChange(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="09xxxxxxxxx یا example@email.com"
            />

          </div>




          <div>

            <label className="block text-sm text-gray-600 mb-1">

              رمز عبور

            </label>


            <input
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="حداقل ۶ کاراکتر"
            />

          </div>




          {error &&

            <p className="text-red-600 text-sm">

              {error}

            </p>

          }



          {message &&

            <p className="text-green-600 text-sm">

              {message}

            </p>

          }




          <button

            type="submit"

            disabled={loading}

            className="w-full bg-blue-900 text-white py-2 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"

          >

            {
              loading
              ? 'لطفاً صبر کن...'
              : isLogin
              ? 'ورود'
              : 'ثبت‌نام'
            }


          </button>




          <p className="text-center text-sm text-gray-500">


            {isLogin
            ? 'حساب نداری؟'
            : 'قبلاً ثبت‌نام کردی؟'
            }



            <button

              type="button"

              onClick={()=>setIsLogin(!isLogin)}

              className="text-blue-900 font-bold mr-1"

            >

              {
                isLogin
                ? 'ثبت‌نام کن'
                : 'وارد شو'
              }


            </button>


          </p>



        </form>

        ) : (

        <div className="space-y-4">

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              شماره موبایل
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={otpPhone}
              onChange={(e) => handleOtpPhoneChange(e.target.value)}
              disabled={otpSent}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900 disabled:bg-gray-100"
              placeholder="09xxxxxxxxx"
            />
          </div>

          {otpSent && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                کد ۶ رقمی
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').substring(0, 6))}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900 text-center text-lg tracking-widest"
                placeholder="------"
              />
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}

          {!otpSent ? (
            <button
              type="button"
              onClick={sendOtp}
              disabled={otpLoading}
              className="w-full bg-blue-900 text-white py-2 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
            >
              {otpLoading ? 'در حال ارسال...' : 'ارسال کد'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={verifyOtp}
                disabled={otpLoading}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {otpLoading ? 'در حال بررسی...' : 'تایید و ورود'}
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpCode(''); setMessage(null); }}
                className="w-full text-sm text-gray-500 py-1"
              >
                تغییر شماره یا ارسال مجدد
              </button>
            </>
          )}

        </div>

        )}


      </div>


    </main>

  );

}
