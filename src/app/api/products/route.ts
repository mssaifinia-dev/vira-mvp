import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      id: 1,
      title: "مودم فیبر نوری",
      price: 3500000,
    },
    {
      id: 2,
      title: "پچ کورد SC/UPC",
      price: 120000,
    },
    {
      id: 3,
      title: "پیگتیل فیبر نوری",
      price: 90000,
    },
    {
      id: 4,
      title: "کلید هوشمند",
      price: 1200000,
    },
  ]);
}