import { NextRequest, NextResponse } from "next/server";
import { openai, pinecone } from "@/lib/clients";

// Constants from assignment
const EMBEDDING_MODEL = "RPRTHPB-text-embedding-3-small";
const CHAT_MODEL = "RPRTHPB-gpt-5-mini";
const TOP_K = 15; // Default top-k, can be up to 30

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
            model: EMBEDDING_MODEL,
            input: question,
        });
        const questionEmbedding = embeddingResponse.data[0].embedding;

        // 2. Query Pinecone
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "ted-talks");
        const queryResponse = await index.query({
            vector: questionEmbedding,
            topK: TOP_K,
            includeMetadata: true,
        });

        // 3. Construct Context
        const retrievedChunks = queryResponse.matches.map((match) => ({
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
            model: CHAT_MODEL,
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
