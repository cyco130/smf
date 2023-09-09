import { startClient } from "../smf/client";
import { App } from "./App";
import { pageRoutes } from "./page-routes";

startClient({ App, pageRoutes }).catch((error) => {
	console.error(error);
});
