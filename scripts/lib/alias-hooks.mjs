import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const SRC = resolvePath(process.cwd(), "src");

export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
        const target = resolvePath(SRC, specifier.slice(2));
        const withExt = /\.[cm]?js$/.test(target) ? target : `${target}.js`;
        return nextResolve(pathToFileURL(withExt).href, context);
    }
    return nextResolve(specifier, context);
}
