import {
	buildHandler,
	prepareApiRoutes,
	preparePageRoutes,
} from "../smf/server";
import { Document } from "./Document";
import { App } from "./App";

const apiRoutes = prepareApiRoutes(import.meta.glob("./routes/**/*.api.ts"));
const pageRoutes = preparePageRoutes(
	import.meta.glob("./routes/**/*.page.tsx"),
);

export default buildHandler({
	apiRoutes,
	pageRoutes,
	Document,
	App,
});
