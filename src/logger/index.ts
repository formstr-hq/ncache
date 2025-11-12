// logger.ts
import fs from "fs";
import path from "path";
import { createLogger, format, transports } from "winston";
import morgan from "morgan";

export const requestLogger = morgan(
  `:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" ":response-time ms"`
);

// Ensure logs/ directory exists
const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Setup Winston logger
const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
    new transports.File({ filename: path.join(logDir, "combined.log") }),
  ],
});

export const overrideConsoleLogger = () => {
  // Override console methods globally
  console.log = (...args: any[]) => {
    logger.info(args.map(String).join(" "));
  };

  console.error = (...args: any[]) => {
    logger.error(args.map(String).join(" "));
  };

  console.warn = (...args: any[]) => {
    logger.warn(args.map(String).join(" "));
  };

  console.debug = (...args: any[]) => {
    logger.debug(args.map(String).join(" "));
  };
};

export default logger;
