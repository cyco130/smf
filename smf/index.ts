import type { Plugin } from "vite";

export function smf(): Plugin[] {
	return [
		{
			name: "smf/load-handler",
			enforce: "post",
			apply: "serve",
			config() {
				return {
					appType: "custom",
				};
			},
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
