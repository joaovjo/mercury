import pkg from "../../../package.json" with { type: "json" };

/** Version baked in at build time, sourced from package.json. */
export const VERSION: string = pkg.version ?? "0.0.0";
