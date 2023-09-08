import { buildHandler } from "../smf/server";

export default buildHandler({
	"/foo": () => import("./routes/foo.api"),
	"/bar": () => import("./routes/bar.api"),
});
