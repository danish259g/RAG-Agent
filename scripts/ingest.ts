import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CSV_FILE = "ted_talks_en.csv";
const MODEL_NAME = "RPRTHPB-text-embedding-3-small";
const CHUNK_SIZE_TOKENS = 512;
const OVERLAP_RATIO = 0.25;
const OVERLAP_TOKENS = Math.floor(CHUNK_SIZE_TOKENS * OVERLAP_RATIO);

// Simple approximation: 1 token ~ 4 characters
const CHARS_PER_TOKEN = 4;
const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

interface Talk {
    talk_id: string;
    title: string;
    transcript: string;
    author: string;
    url: string;
    description: string;
    topics: string;
    views: string;
    published_date: string;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1]) : 0;
const MAX_CHUNKS_ARG = process.argv.find((arg) => arg.startsWith("--max-chunks="));
const MAX_CHUNKS = MAX_CHUNKS_ARG ? parseInt(MAX_CHUNKS_ARG.split("=")[1]) : 0;

import { CONFIG } from "../src/lib/config";
import { smartChunk } from "../src/lib/chunking";

async function main() {
    console.log(`Starting ingestion... Dry Run: ${DRY_RUN}, Limit (Talks): ${LIMIT || "None"}, Max Chunks: ${MAX_CHUNKS || "None"}`);
    console.log(`Config: Chunk Size ${CONFIG.CHUNK_SIZE} tokens, Overlap ${CONFIG.OVERLAP_RATIO * 100}%`);

    // Lazy load clients to ensure env vars are loaded
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { openai, pinecone } = require("../src/lib/clients");

    const talks: Talk[] = [];

    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on("data", (row: any) => {
                if (LIMIT && talks.length >= LIMIT) return;
                talks.push({
                    talk_id: row.talk_id,
                    title: row.title,
                    transcript: row.transcript,
                    author: row.speaker_1,
                    url: row.url,
                    description: row.description,
                    topics: row.topics,
                    views: row.views,
                    published_date: row.published_date
                });
            })
            .on("end", () => {
                resolve();
            })
            .on("error", (err) => reject(err));
    });

    console.log(`Loaded ${talks.length} talks.`);

    let totalChunks = 0;

    // Connect to index
    const indexName = process.env.PINECONE_INDEX_NAME || "ted-talks";
    const index = pinecone.index(indexName);

    for (const talk of talks) {
        if (!talk.transcript) continue;

        // Use Smart Chunking
        const chunks = smartChunk(talk.transcript);
        console.log(`Talk "${talk.title}": ${chunks.length} chunks`);

        const vectors: any[] = [];

        for (let i = 0; i < chunks.length; i++) {
            if (MAX_CHUNKS && totalChunks >= MAX_CHUNKS) {
                console.log(`Reached max chunks limit (${MAX_CHUNKS}). Stopping.`);
                break;
            }
            totalChunks++;
            const chunk = chunks[i];

            // --- DATA ENRICHMENT START ---
            const enrichedText = `
Title: ${talk.title}
Speaker: ${talk.author}
Description: ${talk.description}
Topics: ${talk.topics}
---
${chunk}
`.trim();
            // --- DATA ENRICHMENT END ---

            let embedding: number[] = [];

            if (!DRY_RUN) {
                try {
                    const response = await openai.embeddings.create({
                        model: CONFIG.EMBEDDING_MODEL,
                        input: enrichedText,
                    });
                    embedding = response.data[0].embedding;
                } catch (e) {
                    console.error(`Error embedding chunk for ${talk.title}:`, e);
                    continue;
                }
            } else {
                embedding = new Array(1536).fill(0.1);
            }

            vectors.push({
                id: `${talk.talk_id}_${i}`,
                values: embedding,
                metadata: {
                    talk_id: talk.talk_id,
                    title: talk.title,
                    url: talk.url,
                    author: talk.author,
                    description: talk.description,
                    topics: talk.topics,
                    views: parseInt(talk.views) || 0,
                    published_date: talk.published_date,
                    chunk_text: chunk,
                    chunk_index: i
                }
            });
        }

        if (!DRY_RUN && vectors.length > 0) {
            try {
                await index.upsert(vectors);
                console.log(`Upserted ${vectors.length} vectors for "${talk.title}"`);
            } catch (e) {
                console.error(`Error upserting for ${talk.title}:`, e);
            }
        }

        if (MAX_CHUNKS && totalChunks >= MAX_CHUNKS) break;
    }

    console.log(`Ingestion complete. Total chunks: ${totalChunks}`);
}

main().catch(console.error);

