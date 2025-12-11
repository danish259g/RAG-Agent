import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        chunk_size: 2048,
        overlap_ratio: 0.3,
        top_k: 5
    });
}
