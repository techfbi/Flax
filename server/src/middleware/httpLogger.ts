import morgan from "morgan";
import logger from "../config/logger.js";

// Pipe every HTTP request log through Winston so it ends up in Axiom
// alongside your application logs in one place, not split between
// the hosting platform console and the cloud logger.
const stream = {
  write: (message: string) => logger.http(message.trim()),
};

const httpLogger = morgan(
  process.env.NODE_ENV === "development" ? "dev" : "combined",
  { stream }
);

export default httpLogger;