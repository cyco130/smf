import type { IncomingMessage, RequestListener, ServerResponse } from "http";
import { type ComponentType, type ComponentChildren } from "preact";
import { render } from "preact-render-to-string";
import {
	AppProps,
	PageModule,
	compareRoutePatterns,
	patternToRegExp,
} from "./shared";

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

export interface HandlerOptions {
	apiRoutes: Record<string, () => Promise<ApiModule>>;
	pageRoutes: Record<string, () => Promise<PageModule>>;
	Document: ComponentType<DocumentProps>;
	App: ComponentType<AppProps>;
}

export interface DocumentProps {
	children?: ComponentChildren;
}

export function buildHandler(options: HandlerOptions): RequestListener {
	const pageRoutes = Object.keys(options.pageRoutes)
		.sort(compareRoutePatterns)
		.map(
			(pattern) =>
				[
					patternToRegExp(pattern),
					options.pageRoutes[pattern],
					"page",
				] as const,
		);

	const apiRoutes = Object.keys(options.apiRoutes)
		.sort(compareRoutePatterns)
		.map(
			(pattern) =>
				[patternToRegExp(pattern), options.apiRoutes[pattern], "api"] as const,
		);

	return async function handler(req, res) {
		// These are typed as optional for some reason
		const { url = "/", method = "GET" } = req;

		console.log(`${method} ${url}`);

		// Remove query string and hash
		const path = url.match(/^[^?#]*/)![0];
		// Page routes before API routes
		const match =
			pageRoutes.find(([pattern]) => pattern.exec(path)) ??
			apiRoutes.find(([pattern]) => pattern.exec(path));

		if (!match) {
			res.statusCode = 404;
			res.end("Not found");
			return;
		}

		try {
			// Page or API?
			if (match[2] === "page") {
				const importer = match[1];
				const module = await importer();
				const html = renderPage(module.default, options.Document, options.App);
				res.statusCode = 200;
				res.setHeader("Content-Type", "text/html; charset=utf-8");
				res.end(html);
				return;
			}

			const importer = match[1];
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

function renderPage(
	Page: ComponentType,
	Document: ComponentType<DocumentProps>,
	App: ComponentType<AppProps>,
) {
	const document = render(
		<Document>
			<App>
				<Page />
			</App>
		</Document>,
	);
	return "<!DOCTYPE html>" + document;
}

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

export function preparePageRoutes(
	pageRoutes: Record<string, () => Promise<any>>,
): Record<string, () => Promise<PageModule>> {
	return Object.fromEntries(
		Object.entries(pageRoutes).map(([path, importer]) => {
			let pattern = path.slice("./routes".length, -".page.tsx".length);
			if (pattern.endsWith("/index")) {
				pattern = pattern.slice(0, -"/index".length);
			}

			return [pattern, importer];
		}),
	);
}
