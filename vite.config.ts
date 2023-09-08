import { defineConfig } from "vite";
import { smf } from "./smf";
import { preact } from "@preact/preset-vite";

export default defineConfig({
	plugins: [smf(), preact()],
});
