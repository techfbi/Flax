import { createLogger, format, transports } from "winston";
import { WinstonTransport as AxiomTransport } from "@axiomhq/winston";
import { env } from "./env.js";

const isDev = env.NODE_ENV === "development";

// Development uses readable colored output.
// Production ships JSON to Axiom and keeps a minimal console for
// the hosting platform's own log stream.
const logger = createLogger({
  level: isDev ? "debug" : "info",
  format: isDev
    ? format.combine(
        format.colorize(),
        format.timestamp({ format: "HH:mm:ss" }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length
            ? " " + JSON.stringify(meta)
            : "";
          return `${timestamp} [${level}] ${message}${extras}`;
        })
      )
    : format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

// Only wire up Axiom in production and only if the env vars are present.
// Missing Axiom config in development is not an error.
if (!isDev && env.AXIOM_TOKEN && env.AXIOM_DATASET) {
  logger.add(
    new AxiomTransport({
      dataset: env.AXIOM_DATASET,
      token: env.AXIOM_TOKEN,
    })
  );
}

export default logger;