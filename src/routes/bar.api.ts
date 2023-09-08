import type { RequestHandler } from "../../smf/server";

export const get: RequestHandler = ({ res }) => {
	res.end("Hello from foo!");
};
