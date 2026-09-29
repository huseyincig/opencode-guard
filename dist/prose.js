/**
 * Strips quoted text, markdown code blocks, inline code, and blockquotes from
 * assistant prose so that meta-discussions, citations, and rule explanations do
 * not trigger false positive detections.
 */
export function sanitizeProseForInspection(text) {
    if (typeof text !== "string")
        return "";
    return text
        // Strip fenced code blocks (``` ... ```)
        .replace(/```[\s\S]*?```/g, " ")
        // Strip inline code spans (` ... `)
        .replace(/`[^`\n]+`/g, " ")
        // Strip markdown blockquotes (> ...)
        .replace(/^>+[^\n]*/gm, " ")
        // Strip double-quoted or smart-quoted phrases ("..." or “...”)
        .replace(/(?:["“][^"”\n]{1,300}["”])/g, " ")
        // Collapse whitespace
        .replace(/\s+/g, " ")
        .trim();
}
