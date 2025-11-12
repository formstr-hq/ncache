import express from "express";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT || 5001);

const app = express();

app.get("/health", (req, res) => {
  res.send({ redisStatus: "Connected" });
});

app.get("/", (req, res) => {
  res.send({ message: "Hello world" });
});

app.listen(port, (err) => {
  if (err) {
    throw err;
  } else {
    console.log(`server listening on port ${port}`);
  }
});
