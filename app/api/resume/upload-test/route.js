import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    console.log("Test upload API called");
    return NextResponse.json({ message: "Test API working" });
  } catch (error) {
    console.error("Test API error:", error);
    return new NextResponse("Test API Error", { status: 500 });
  }
}

export async function GET(req) {
  return NextResponse.json({ message: "Test API GET working" });
}