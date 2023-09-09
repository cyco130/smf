import { AppProps } from "../smf/server";

export function App(props: AppProps) {
	return <div>{props.children}</div>;
}
