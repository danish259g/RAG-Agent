export const CONFIG = {
    // Model Config
    EMBEDDING_MODEL: "RPRTHPB-text-embedding-3-small",
    CHAT_MODEL: "RPRTHPB-gpt-5-mini",

    // Chunking Config
    CHUNK_SIZE: 512, // Tokens
    OVERLAP_RATIO: 0.2, // 20%

    // Retrieval Config
    TOP_K_RETRIEVAL: 30, // Fetch more to filter for diversity
    TOP_K_CONTEXT: 10,   // Final context size
    MAX_CHUNKS_PER_TALK: 2, // Diversity constraint

    // Ingestion
    CHARS_PER_TOKEN: 4, // Approx
};
