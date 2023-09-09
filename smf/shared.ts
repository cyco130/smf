import type { ComponentType, ComponentChildren } from "preact";

export interface PageModule {
	default: ComponentType;
}

export interface AppProps {
	children: ComponentChildren;
}

export function patternToRegExp(path: string) {
	return RegExp(
		"^" +
			path
				.replace(/[\\^*+?.()|[\]{}]/g, (x) => `\\${x}`) // Escape special characters except $
				.replace(/\$\$(\w+)$/, "(?<$1>.*)") // $$rest to named capture group
				.replace(/\$(\w+)(\?)?(\.)?/g, "$2(?<$1>[^/]+)$2$3") + // $param to named capture groups
			"/?$", // Optional trailing slash and end of string
	);
}

export function compareRoutePatterns(a: string, b: string): number {
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
