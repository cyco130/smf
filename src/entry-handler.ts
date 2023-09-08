import { buildHandler, prepareApiRoutes } from "../smf/server";

const apiRoutes = import.meta.glob("./routes/**/*.api.ts");

export default buildHandler(prepareApiRoutes(apiRoutes));
