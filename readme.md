# SMF - Build Your Own Metaframework with Vite

Recently, in [one of my tweets](https://twitter.com/cyco130/status/1699768992309617108), I claimed that building a metaframework (a.k.a. a [Next.js](https://nextjs.org/) clone 😅) with [Vite](https://vitejs.dev) is easy. This article is an attempt to prove that somewhat bold claim by creating a reasonably usable [Preact](https://preactjs.com)[^1] metaframework called SMF. SMF may stand for either "Simple MetaFramework" or [the name of the fan club of Twisted Sister](https://www.youtube.com/watch?v=KDpO8OKHzk8), my favorite band in my teenage years. You decide.

In this article, I will be assuming that you are reasonably familiar with Preact, Vite, and the concept of server-side rendering (SSR). I will use `pnpm` but it's not a requirement. You can use `npm` or `yarn` if you prefer.

[^1]: The reason I picked Preact is that there doesn't seem to be a good Vite-based Preact metaframework as of yet.

## 01. Project setup

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

## 02. Using `ssrLoadModule` to run server code

[Vite's own SSR guide](https://vitejs.dev/guide/ssr.html) recommends using Vite in "middleware mode". If we followed it, we would use `vite.createServer` with `{ server: { middlewareMode: true } }` to create a Vite development middleware, then create a Node server with, e.g. Express, and add the Vite middleware to it. Then we would use `viteDevServer.ssrLoadModule` to load our server code.

This flow poses a chicken-and-egg problem if we want to use TypeScript or JSX: We need Vite's dev server to compile our server code but we need the server code to create the Vite middleware. We could use a separate tool like `ts-node` but to me, it doesn't make sense to use a separate tool when Vite is already there. This approach also requires us to give up on Vite's CLI and handle all options ourselves. That's not ideal.

To solve this, we will take the recommended flow and turn it around: Instead of using Vite as a middleware in our server, we will use our server code as a middleware in Vite's dev server. Vite plugins can define a [`configureServer`](https://vitejs.dev/guide/api-plugin.html#configureserver) hook to hook into Vite's dev server. We will use it to load our server code with the `ssrLoadModule` method of the [Vite dev server](https://vitejs.dev/guide/api-javascript.html#vitedevserver) and inject it as a middleware. Vite uses `connect` under the hood, you can think of it as Express minus the router. We can add a middleware with `server.middlewares.use` just like adding an Express middleware. Here's how, read the comments for details:

`smf/smf.ts`

```ts
import type { Plugin } from "vite";

export function smf(): Plugin[] {
  return [
    {
      name: "smf/load-handler",
      enforce: "post",
      apply: "serve",
      configureServer(server) {
        // Instead of adding the middleware here, we return a function that Vite
        // will call after adding its own middlewares. We want our code to run after
        // Vite's transform middleware so that we can focus on handling the requests
        // we're interested in.
        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              const handlerModule = await server.ssrLoadModule(
                // This is where we'll put our handler
                server.config.root + "/src/entry-handler.ts",
                {
                  // This is required to make errors thrown in the handler
                  // to have the correct stack trace.
                  fixStacktrace: true,
                },
              );

              await handlerModule.default(req, res);

              // We're not calling `next` because our handler will always be
              // the last one in the chain. If it didn't send a response, we
              // will treat it as an error since there will be no one else to
              // handle it in production.
              if (!res.writableEnded) {
                next(new Error("SSR handler didn't send a response"));
              }
            } catch (error) {
              // Forward the error to Vite
              next(error);
            }
          });
        };
      },
    },
  ];
}
```

And our first handler will look like this:

`src/entry-handler.ts`

```ts
import type { RequestListener } from "node:http";

const handler: RequestListener = async (req, res) => {
  // res.send is not available in plain Node.js, it's added by Express.
  // We have to use res.write and/or res.end instead.
  res.end(`Received a ${req.method} request to ${req.url}.`);
};

export default handler;
```

If you run `pnpm dev` now, you should see the following output in the browser:

```txt
Received a GET request to /index.html.
```

That's weird. We requested `/` but Vite rewrote it to `/index.html` when its transform middleware couldn't find anything to serve. We don't want that, we need to set Vite's [`appType`](https://vitejs.dev/config/shared-options.html#apptype) configuration option to `"custom"` to tell Vite that we will be serving our own dynamically generated HTML, not an `index.html` file from the file system. We could set it in `vite.config.ts` but that file belongs to the user. We should do it in our plugin's `config` hook instead so that when the user adds our plugin, they don't have to worry about it:

`smf/smf.ts`

```
      apply: "serve",
+     config() {
+       return {
+         appType: "custom",
+       };
+     },
      configureServer(server) {
```

Now visiting `localhost:5173/` should give us the expected output:

```txt
Received a GET request to /.
```

If you change the handler code and refresh the page, you will see the changes reflected (we will cover automatic reloading and HMR later). It works because `ssrLoadModule` will invalidate its cache when a file or its dependencies change. This is not exactly hot module replacement (HMR), which Vite doesn't support for server code yet, but it's similar in that it allows us to change the code and see the changes without restarting the server.

This exact "the app as middleware" trick is used by many Vite-based metaframeworks such as [SvelteKit](https://kit.svelte.dev), [Astro](https://astro.build), [SolidStart](https://start.solidjs.com), and [Qwik](https://qwik.builder.io). My [vavite](https://github.com/cyco130/vavite) package, a set of tools for developing and building server-side applications with Vite that [Rakkas](https://rakkasjs.org) uses under the hood, makes it even easier and solves a bunch of other challenges we will face later. Ordinarily, I would start with `vavite` and skip this section and several others but I promised a "from scratch" tutorial so here we are.

Some other metaframeworks (most notably [Nuxt](https://nuxt.com)) use [`vite-node`](https://github.com/vitest-dev/vitest/tree/main/packages/vite-node) which is currently part of the Vitest project but it is expected to be [merged into Vite core](https://github.com/vitejs/vite/pull/12165) in the future. It is more difficult to set up but it has additional features like customizable HMR behavior and the ability to run Vite's server and the app code in separate VM contexts or processes. Nevertheless, we will stick with our simpler approach that has been proven to be more than adequate by so many successful metaframeworks.

> ✅ Checkpoint: You can find the progress so far in the `chapter-02` tag.

## 03. API routes

> This may come as a surprise that we're implementing API routes before page routes but API routes are a more fundamental concept if you think about it. A page route is just a special kind of API route that returns HTML.

At this point, we have a pretty neat setup for running server code with Vite. The default export of `src/entry-handler.ts` is simply a Node HTTP request listener that all Node HTTP frameworks are ultimately based on: In Express, the `app` itself is a request listener; in Koa, you can get one with `app.callback()`; in Fastify, you can use `(req, res) => fastify.server.emit("request", req, res)` to create one once the server is ready; and so on. So we are in a position to use any popular Node HTTP framework we want. But we won't, because "from scratch" means "from scratch" 😅.

We'll start by implementing a simple router. The router will map paths to API modules. API modules will export a set of functions named after HTTP methods and they will be called when a request with the corresponding method is received. The signature will be `method(ctx: RequestContext): void | Promise<void>` where `RequestContext` is a simple object with `req`, `res`, and `params` properties. `params` will hold dynamic path parameters.

Most Node server frameworks use a builder pattern for the router. You create a router and you add routes to it in an imperative manner. We'll use a simpler declarative router instead. Building an imperative one on top of it is trivial if we need it later. Most Node server frameworks use a variation of the `/path/to/:param/*rest` syntax for route patterns. We'll use a slightly modified one because we want to support file system routing later but `:` and `*` are hard to use in file names on Linux and Mac, and flat-out forbidden on Windows. I'll go with a loosely [Remix](https://remix.run/docs/en/main/file-conventions/route-files-v2#route-file-naming-v2)-inspired `/path/to/$param/$$rest` syntax. The usage will look something like this:

```ts
export default buildHandler({
  "/foo": () => import("./routes/foo"),
  "/bar": () => import("./routes/bar"),
  "/baz/$id": () => import("./routes/baz"),
  "/qux/$$rest": () => import("./routes/qux"),
});
```

There are some neat TypeScript tricks to infer the type of `params` object from the route pattern but we won't go into that here. Also, for simplicity, we will use a linear regexp search. I didn't test the following thoroughly but it seemed to work with a few cases I tried it with. Our MF is called SMF, so good enough for Rock'n'Roll 🤘.

This will be part of SMF's server runtime so we'll put it in `smf/server.ts`:

`smf/server.ts`

```ts
import type { IncomingMessage, RequestListener, ServerResponse } from "http";

export type RequestHandler<P = Record<string, string>> = (
  ctx: RequestContext<P>,
) => void | Promise<void>;

export interface RequestContext<P = Record<string, string>> {
  req: IncomingMessage;
  res: ServerResponse;
  params: P;
}

export interface ApiModule<P = Record<string, string>> {
  get?: RequestHandler<P>;
  post?: RequestHandler<P>;
  put?: RequestHandler<P>;
  delete?: RequestHandler<P>;
  patch?: RequestHandler<P>;
  options?: RequestHandler<P>;
  head?: RequestHandler<P>;
  all?: RequestHandler<P>; // Fallback for all methods
}

export function buildHandler(
  apiRoutes: Record<string, () => Promise<ApiModule>>,
): RequestListener {
  // Convert into an array of [RegExp, () => Promise<ApiModule>] tuples
  const routes = Object.entries(apiRoutes).map(
    ([path, importer]) => [patternToRegExp(path), importer] as const,
  );

  return async function handler(req, res) {
    // These are typed as optional for some reason
    const { url = "/", method = "GET" } = req;

    // Remove query string and hash
    const path = url.match(/^[^?#]*/)![0];
    const match = routes.find(([pattern]) => pattern.exec(path));

    if (!match) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const importer = match[1];
    try {
      const module = await importer();
      const handler =
        module[method.toLowerCase() as keyof ApiModule] ?? module.all;

      if (!handler) {
        // Look ma, I'm HTTP-ly correct!
        res.statusCode = 405;
        res.end("Method not allowed");
        return;
      }

      const params = match[0].exec(path)?.groups ?? {};
      await handler({ req, res, params });
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  };
}

function patternToRegExp(path: string) {
  return RegExp(
    "^" +
      path
        .replace(/[\\^*+?.()|[\]{}]/g, (x) => `\\${x}`) // Escape special characters except $
        .replace(/\$\$(\w+)$/, "(?<$1>.*)") // $$rest to named capture group
        .replace(/\$(\w+)(\?)?(\.)?/g, "$2(?<$1>[^/]+)$2$3") + // $param to named capture groups
      "/?$", // Optional trailing slash and end of string
  );
}
```

Now let's create a couple of API route modules in `src/routes`. I will use the `.api.ts` convention for API routes, it will come in handy when we implement file system routing later. I prefer an explicit naming convention to exposing every file in a directory as a route.

`src/routes/foo.api.ts`

```ts
import type { RequestHandler } from "../../smf/server";

export const get: RequestHandler = ({ res }) => {
  res.end("Hello from foo!");
};
```

`src/routes/bar.api.ts`

```ts
import type { RequestHandler } from "../../smf/server";

export const get: RequestHandler = ({ res }) => {
  res.end("Hello from bar!");
};
```

Finally, let's update `src/entry-handler.ts` to use our new router:

`src/entry-handler.ts`

```ts
import { buildHandler } from "../smf/server";

export default buildHandler({
  "/foo": () => import("./routes/foo.api"),
  "/bar": () => import("./routes/bar.api"),
});
```

If you run `pnpm dev` now, you will get a 404 for `/` because we don't have a handler for it yet. But `/foo` and `/bar` should work as expected. So here we go, we have API routes.

> ✅ Checkpoint: You can find the progress so far in the `chapter-03` tag.

## 04. File system routing

Developers have a love-hate relationship with file system routing. It's simple and intuitive at first but file names make a poor configuration language. As more and more features are added, you risk ending up with monstrosities like `/foo/bar/@top-bar/(..)(..)[...slug].tsx`. Nevertheless, file system routing is one of the staples of metaframework design. So we'll implement it too but we'll take a hybrid approach: It will be strictly optional and the user will be able to modify automatically generated routes as they see fit.

Vite has a [`import.meta.glob`](https://vitejs.dev/guide/features.html#glob-import) feature that allows us to implement file system routing with very little effort. The docs say:

> ```js
> const modules = import.meta.glob("./dir/*.js");
> ```
>
> The above will be transformed into the following:
>
> ```js
> // code produced by vite
> const modules = {
>   "./dir/foo.js": () => import("./dir/foo.js"),
>   "./dir/bar.js": () => import("./dir/bar.js"),
> };
> ```

This is the exact format our router expects. What a coincidence! 😄

First, we'll add the following to `tsconfig.json` to have Vite-specific types (like the types for `import.meta.glob`) available in our code:

```
    "jsxImportSource": "preact",
+   "types": ["vite/client"]
  }
}
```

Now we can add `const apiRoutes = import.meta.glob("./routes/**/*.api.ts");` to `src/entry-handler.ts`. According to the docs, the outcome will be the same as if we had written:

```ts
const apiRoutes = {
  "./routes/foo.api.ts": () => import("./routes/foo.api.ts"),
  "./routes/bar.api.ts": () => import("./routes/bar.api.ts"),
};
```

As far as I can remember Vite takes care of normalizing path separators to forward slashes on Windows. So all we need to do is trim the `./routes` prefix and the `.api.ts` suffix to convert the file names into route patterns. We will also trim `/index` from the end of the route patterns to make `/foo.api.ts` and `/foo/index.api.ts` equivalent (we need it at least for the root route!). We'll implement this in a `prepareApiRoutes` function that we'll add to the bottom of `smf/server.ts`. The types are lenient because `import.meta.glob` is not strongly typed anyway:

`smf/server.ts`

```ts
export function prepareApiRoutes(
  apiRoutes: Record<string, () => Promise<any>>,
): Record<string, () => Promise<ApiModule>> {
  return Object.fromEntries(
    Object.entries(apiRoutes).map(([path, importer]) => {
      // This is a bit fragile as it doesn't allow different file extensions
      // but again, good enough for Rock'n'Roll.
      let pattern = path.slice("./routes".length, -".api.ts".length);
      if (pattern.endsWith("/index")) {
        pattern = pattern.slice(0, -"/index".length);
      }

      return [pattern, importer];
    }),
  );
}
```

We will also need to sort the routes so that more specific routes come first. When the user was adding routes manually, we could dump this responsibility on them like Express does but since the order of the routes is not under the user's control anymore, we'll have to do it ourselves. Unfortunately, there are no universally applicable rules here: Should `/foo/bar` match `/foo/$param` or `/$param/bar` first? I'm inclined to say the former but it's more of an opinion than a fact. However, I'm sure everyone will agree that `/foo/$a-$b/bar` should come before `/foo/$a/bar`. I'll adapt a simplified version of the sorting rules used by Rakkas. Feel free to disagree and modify it to your liking:

```ts
function compareRoutePatterns(a: string, b: string): number {
  // Non-catch-all routes first: /foo before /$$rest
  const catchAll =
    Number(a.match(/\$\$(\w+)$/)) - Number(b.match(/\$\$(\w+)$/));
  if (catchAll) return catchAll;

  // Split into segments
  const aSegments = a.split("/");
  const bSegments = b.split("/");

  // Routes with fewer dynamic segments first: /foo/bar before /foo/$bar
  const dynamicSegments =
    aSegments.filter((segment) => segment.includes("$")).length -
    bSegments.filter((segment) => segment.includes("$")).length;
  if (dynamicSegments) return dynamicSegments;

  // Routes with fewer segments first: /foo/bar before /foo/bar
  const segments = aSegments.length - bSegments.length;
  if (segments) return segments;

  // Routes with earlier dynamic segments first: /foo/$bar before /$foo/bar
  for (let i = 0; i < aSegments.length; i++) {
    const aSegment = aSegments[i];
    const bSegment = bSegments[i];
    const dynamic =
      Number(aSegment.includes("$")) - Number(bSegment.includes("$"));
    if (dynamic) return dynamic;

    // Routes with more dynamic subsegments at this position first: /foo/$a-$b before /foo/$a
    const subsegments = aSegment.split("$").length - bSegment.split("$").length;
    if (subsegments) return subsegments;
  }

  // Equal as far as we can tell
  return 0;
}
```

Then we'll have to update the first few lines of `buildHandler` to use our comparison function:

```ts
export function buildHandler(
	apiRoutes: Record<string, () => Promise<ApiModule>>,
): RequestListener {
  // Convert into an array of [RegExp, () => Promise<ApiModule>] tuples
  const routes = Object.keys(apiRoutes)
    .sort(compareRoutePatterns)
    .map((pattern) => [patternToRegExp(pattern), apiRoutes[pattern]] as const);
  // ...
```

Now we can use `prepareApiRoutes` in `src/entry-handler.ts`:

`src/entry-handler.ts`

```ts
import { buildHandler, prepareApiRoutes } from "../smf/server";

const apiRoutes = import.meta.glob("./routes/**/*.api.ts");

export default buildHandler(prepareApiRoutes(apiRoutes));
```

If you run `pnpm dev` now, you will see that `/foo` and `/bar` still work. If you delete or rename one of them, it will be reflected in the app. That's it, we have file system routing! The user can change the contents of the `apiRoutes` object before passing it to `buildHandler` or simply not use it at all and define their own routes. Best of both worlds.

Although `import.meta.glob` is pretty flexible, some Vite-based metaframeworks use a custom file system routing solution. Rakkas, for example, generates a set of virtual modules for extra flexibility. SvelteKit follows a similar approach. But some do use `import.meta.glob` and it's a perfectly good solution for most use cases.

> ✅ Checkpoint: You can find the progress so far in the `chapter-04` tag.
