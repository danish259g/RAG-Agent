import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

export const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});
