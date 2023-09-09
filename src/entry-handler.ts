import { buildHandler, prepareApiRoutes } from "../smf/server";
import { Document } from "./Document";
import { App } from "./App";
import { pageRoutes } from "./page-routes";

const apiRoutes = prepareApiRoutes(import.meta.glob("./routes/**/*.api.ts"));

export default buildHandler({
	apiRoutes,
	pageRoutes,
	Document,
	App,
});
