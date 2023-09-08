import type { RequestListener } from "node:http";

const handler: RequestListener = async (req, res) => {
	// res.send is not available in plain Node.js, it's added by Express.
	// We have to use res.write and/or res.end instead.
	res.end(`Received a ${req.method} request to ${req.url}.`);
};

export default handler;
