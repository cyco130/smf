import { preparePageRoutes } from "../smf/server";

export const pageRoutes = preparePageRoutes(
	import.meta.glob("./routes/**/*.page.tsx"),
);
