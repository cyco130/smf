import type { AppProps } from "../smf/shared";

export function App(props: AppProps) {
	return (
		<div>
			<nav>
				<a href="/">Home</a> | <a href="/about">About</a>
			</nav>
			<main>{props.children}</main>
		</div>
	);
}
