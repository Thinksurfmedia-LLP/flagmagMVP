// Safe regexes built from user-supplied search text (query-string params).
// Raw input passed straight into `$regex` / `new RegExp()` lets a caller
// inject pattern syntax: "(" crashes the query with a 500, and something
// like "(a+)+$" forces catastrophic backtracking on the database or Node
// (ReDoS). Everything here is escaped to match as plain text, trimmed, and
// length-capped. Pure CommonJS so it runs under `node --test`.

const MAX_SEARCH_LENGTH = 100;

/** Escape every regex metacharacter so `text` matches literally. */
function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function normalize(input) {
    if (typeof input !== "string") return null;
    const trimmed = input.trim().slice(0, MAX_SEARCH_LENGTH);
    return trimmed === "" ? null : trimmed;
}

/** Case-insensitive "contains" match, or null when there's nothing to search. */
function containsRegex(input) {
    const text = normalize(input);
    return text === null ? null : new RegExp(escapeRegex(text), "i");
}

/** Case-insensitive whole-value match (e.g. an exact team name), or null. */
function exactRegex(input) {
    const text = normalize(input);
    return text === null ? null : new RegExp(`^${escapeRegex(text)}$`, "i");
}

module.exports = { escapeRegex, containsRegex, exactRegex, MAX_SEARCH_LENGTH };
