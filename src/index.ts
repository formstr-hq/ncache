import { requestLogger, overrideConsoleLogger } from "./logger";
import express from "express";
import dotenv from "dotenv";
import { router } from "./routes";

overrideConsoleLogger();

dotenv.config();

const port = Number(process.env.PORT || 5001);

const app = express();

app.use(requestLogger);

app.use(router);

app.listen(port, (err) => {
  if (err) {
    throw err;
  } else {
    console.log(`server listening on port ${port}`);
  }
});
