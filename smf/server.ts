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
				.replace(/\$(\w+)(\?)?(\.)?/g, "$2(?<$1>[^/]+)$2$3"), // $param to named capture groups
	);
}
