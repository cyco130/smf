import { hydrate, type ComponentType } from "preact";
import {
	patternToRegExp,
	compareRoutePatterns,
	type PageModule,
	type AppProps,
} from "./shared";

export interface ClientOptions {
	App: ComponentType<AppProps>;
	pageRoutes: Record<string, () => Promise<PageModule>>;
}

export async function startClient(options: ClientOptions) {
	const { App, pageRoutes } = options;
	const routes = Object.keys(pageRoutes)
		.sort(compareRoutePatterns)
		.map((pattern) => [patternToRegExp(pattern), pageRoutes[pattern]] as const);

	console.log(routes);

	const path = location.pathname;
	const match = routes.find(([pattern]) => pattern.exec(path));

	if (!match) {
		throw new Error(`No route found for ${path}`);
	}

	const importer = match[1];
	const module = await importer();

	const Page = module.default;

	hydrate(
		<App>
			<Page />
		</App>,
		document.getElementById("app")!,
	);
}
