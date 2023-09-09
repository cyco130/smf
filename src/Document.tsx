import { DocumentProps } from "../smf/server";

export function Document(props: DocumentProps) {
	return (
		<html>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width" />
				<title>My SMF App</title>
			</head>
			<body>
				<div id="app">{props.children}</div>
			</body>
		</html>
	);
}
