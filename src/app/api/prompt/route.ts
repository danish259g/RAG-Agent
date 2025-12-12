import { NextRequest, NextResponse } from "next/server";
import { openai, pinecone } from "@/lib/clients";
import { CONFIG } from "@/lib/config";

// System Prompt from assignment
const SYSTEM_PROMPT = `You are a TED Talk assistant that answers questions strictly and only based on the TED dataset context provided to you (metadata and transcript passages). You must not use any external knowledge, the open internet, or information that is not explicitly contained in the retrieved context. If the answer cannot be determined from the provided context, respond: “I don’t know based on the provided TED data.” Always explain your answer using the given context, quoting or paraphrasing the relevant transcript or metadata when helpful.`;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { question } = body;

        if (!question) {
            return NextResponse.json({ error: "Missing question" }, { status: 400 });
        }

        // 1. Embed the question
        const embeddingResponse = await openai.embeddings.create({
            model: CONFIG.EMBEDDING_MODEL,
            input: question,
        });
        const questionEmbedding = embeddingResponse.data[0].embedding;

        // 2. Query Pinecone (Fetch more candidates for diversity filtering)
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "ted-talks");
        const queryResponse = await index.query({
            vector: questionEmbedding,
            topK: CONFIG.TOP_K_RETRIEVAL, // Fetch 30
            includeMetadata: true,
        });

        // 3. Smart Context Construction (Diversity Logic)
        const allMatches = queryResponse.matches || [];

        // Group by Talk ID
        const talksMap = new Map<string, typeof allMatches>();
        for (const match of allMatches) {
            const talkId = match.metadata?.talk_id as string;
            if (!talkId) continue;

            if (!talksMap.has(talkId)) {
                talksMap.set(talkId, []);
            }
            talksMap.get(talkId)?.push(match);
        }

        // Filter: Keep max 2 chunks per talk
        const diverseChunks: typeof allMatches = [];
        for (const [talkId, chunks] of talksMap.entries()) {
            // Sort chunks of this talk by score (descending)
            chunks.sort((a, b) => (b.score || 0) - (a.score || 0));
            // Take top N for this talk
            diverseChunks.push(...chunks.slice(0, CONFIG.MAX_CHUNKS_PER_TALK));
        }

        // Re-rank: Sort all diverse chunks by score
        diverseChunks.sort((a, b) => (b.score || 0) - (a.score || 0));

        // Take Top K for final Context
        const finalMatches = diverseChunks.slice(0, CONFIG.TOP_K_CONTEXT);

        const retrievedChunks = finalMatches.map((match) => ({
            talk_id: match.metadata?.talk_id,
            title: match.metadata?.title,
            chunk: match.metadata?.chunk_text,
            score: match.score,
            author: match.metadata?.author,
            description: match.metadata?.description,
            topics: match.metadata?.topics,
            views: match.metadata?.views,
            published_date: match.metadata?.published_date,
            url: match.metadata?.url,
        }));

        const contextText = retrievedChunks
            .map(
                (chunk) =>
                    `Title: ${chunk.title}
Speaker: ${chunk.author}
Description: ${chunk.description || "N/A"}
Topics: ${chunk.topics || "N/A"}
Views: ${chunk.views || "N/A"}
Published: ${chunk.published_date || "N/A"}
Link: ${chunk.url}
Talk ID: ${chunk.talk_id}
Content: ${chunk.chunk}
----------------`
            )
            .join("\n\n");

        const userPrompt = `Context:\n${contextText}\n\nQuestion: ${question}`;

        // 4. Call Chat Model
        const chatResponse = await openai.chat.completions.create({
            model: CONFIG.CHAT_MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
            ],
        });

        const finalResponse = chatResponse.choices[0].message.content;

        // 5. Return JSON response
        return NextResponse.json({
            response: finalResponse,
            context: retrievedChunks,
            Augmented_prompt: {
                System: SYSTEM_PROMPT,
                User: userPrompt,
            },
        });
    } catch (error: any) {
        console.error("Error in /api/prompt:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
