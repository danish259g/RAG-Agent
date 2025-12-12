import { CONFIG } from "./config";

/**
 * Splits text into chunks respecting semantic boundaries and overlap.
 */
export function smartChunk(
    text: string,
    chunkSize: number = CONFIG.CHUNK_SIZE * CONFIG.CHARS_PER_TOKEN,
    overlap: number = Math.floor(CONFIG.CHUNK_SIZE * CONFIG.CHARS_PER_TOKEN * CONFIG.OVERLAP_RATIO)
): string[] {
    if (text.length <= chunkSize) {
        return [text];
    }

    // 1. Split into "semantic units" (paragraphs -> sentences)
    // We want a flat list of units that we can merge.
    // Ideally, we split by \n\n first, but if those are too big, we split them by \n, etc.
    const units = splitIntoUnits(text);

    // 2. Merge units into chunks with overlap
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < units.length; i++) {
        const unit = units[i];

        // If adding this unit exceeds chunk size...
        if (currentLength + unit.length > chunkSize) {
            // Push current chunk if valid
            if (currentLength > 0) {
                chunks.push(currentChunk.join(""));
            }

            // Handle Overlap:
            // We need to start the next chunk with some content from the end of the previous chunk.
            // We backtrack in `currentChunk` until we have ~overlap characters.
            let overlapBuffer: string[] = [];
            let overlapLength = 0;

            // Iterate backwards
            for (let j = currentChunk.length - 1; j >= 0; j--) {
                const prevUnit = currentChunk[j];
                if (overlapLength + prevUnit.length > overlap) {
                    break;
                }
                overlapBuffer.unshift(prevUnit);
                overlapLength += prevUnit.length;
            }

            // Reset current chunk to the overlap buffer + new unit
            currentChunk = [...overlapBuffer, unit];
            currentLength = overlapLength + unit.length;

            // Edge case: If the singleton unit itself is bigger than chunk size
            // (e.g. valid unit, but massive).
            // `splitIntoUnits` should theoretically prevent this largely, but if it happens:
            if (unit.length > chunkSize) {
                // For safety, force split it (naive)
                // This overwrites what we just did.
                const subChunks = naiveSplit(unit, chunkSize, overlap);
                // We push all subchunks except the last one? 
                // Or just push them all and reset.
                chunks.push(...subChunks);
                currentChunk = [];
                currentLength = 0;
            }

        } else {
            currentChunk.push(unit);
            currentLength += unit.length;
        }
    }

    if (currentLength > 0) {
        chunks.push(currentChunk.join(""));
    }

    return chunks;
}

function splitIntoUnits(text: string): string[] {
    // Split by Double Newline
    const paragraphs = text.split(/(\n\n)/g); // Keep separators
    let units: string[] = [];

    for (const p of paragraphs) {
        if (p.length > 200) { // arbitrary "large" paragraph limit
            // Split by sentence
            // Match sentence endings but keep delimiters
            const sentences = p.split(/([.!?]\s+)/g);
            units.push(...sentences);
        } else {
            units.push(p);
        }
    }
    // Clean up empty strings
    return units.filter(u => u.length > 0);
}

function naiveSplit(text: string, size: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        let end = start + size;
        if (end > text.length) end = text.length;
        chunks.push(text.slice(start, end));
        start += (size - overlap);
        if (end === text.length) break;
    }
    return chunks;
}
