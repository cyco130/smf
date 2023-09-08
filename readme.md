# SMF - Build Your Own Metaframework with Vite

Recently, in [one of my tweets](https://twitter.com/cyco130/status/1699768992309617108), I claimed that building a metaframework (a.k.a. a [Next.js](https://nextjs.org/) clone 😅) with [Vite](https://vitejs.dev) is easy. This article is an attempt to prove that somewhat bold claim by creating a reasonably usable [Preact](https://preactjs.com)[^1] metaframework called SMF. SMF may stand for either "Simple MetaFramework" or [the name of the fan club of Twisted Sister](https://www.youtube.com/watch?v=KDpO8OKHzk8), my favorite band in my teenage years. You decide.

In this article, I will be assuming that you are reasonably familiar with Preact, Vite, and the concept of server-side rendering (SSR). I will use `pnpm` but it's not a requirement. You can use `npm` or `yarn` if you prefer.

[^1]: The reason I picked Preact is that there doesn't seem to be a good Vite-based Preact metaframework as of yet.

## 01. Project Setup

I started with the following files:

`.gitignore`

```gitignore
node_modules
dist
```

`package.json`

```json
{
  "name": "smf",
  "private": true,
  "type": "module"
}
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "ESNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

I also copied my `.prettierrc` from another project. Omitted here for brevity.

Then I installed the dependencies.

```sh
pnpm i -S preact preact-render-to-string
pnpm i -D prettier vite @preact/preset-vite @types/node
```

Since we're using a single repo, the code for SMF and the code for the example app will live side by side. The `src` directory will contain the example app and the `smf` directory will contain the code for SMF. SMF will be a set of Vite plugins. Here's the initial version:

`smf/smf.ts`

```ts
import type { Plugin } from "vite";

export function smf(): Plugin[] {
  // A list of plugins, empty for now
  return [];
}
```

And the initial Vite config:

`vite.config.ts`

```ts
import { defineConfig } from "vite";
import { smf } from "./smf";
import { preact } from "@preact/preset-vite";

export default defineConfig({
  plugins: [smf(), preact()],
});
```

Finally, I added a `dev` script to `package.json`:

```
  "type": "module",
+ "scripts": {
+   "dev": "vite"
+ },
  "dependencies": {
```

Now we can run `pnpm dev` and see that Vite is working. It will start serving our "app" on `localhost:5173` but you'll get a 404 since we haven't created an app yet.

> ✅ Checkpoint: You can find the progress so far in the `chapter-01` tag.
