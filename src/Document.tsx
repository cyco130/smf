import { DocumentProps } from "../smf/server";

export function Document(props: DocumentProps) {
	return (
		<html>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width" />
				<title>My SMF App</title>
				<script type="module" src="@vite/client" />
			</head>
			<body>
				<div id="app">{props.children}</div>
				<script type="module" src="/src/entry-client.tsx" />
			</body>
		</html>
	);
}
