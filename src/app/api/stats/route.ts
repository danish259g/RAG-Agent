import { CONFIG } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        chunk_size: CONFIG.CHUNK_SIZE,
        overlap_ratio: CONFIG.OVERLAP_RATIO,
        top_k: CONFIG.TOP_K_CONTEXT // Reporting the K used for context, or retrieval? Assignment says "Top-k (number of retrieved chunks)". Usually this means what goes to the model.
    });
}
