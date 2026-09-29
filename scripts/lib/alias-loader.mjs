// Lets standalone scripts import app modules that use the Next.js "@/"
// path alias (see jsconfig.json). Usage:
//   node --import ./scripts/lib/alias-loader.mjs scripts/<script>.mjs
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
