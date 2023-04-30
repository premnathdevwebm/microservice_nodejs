const express = require("express");
const axios = require("axios");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { createClient } = require("redis");

const app = express();
const client = createClient();

client.on("error", (err) => console.log("Redis Client Error", err));
client.on("ready", () => console.log("Redis Client is connected"));

function bootstrap(callback) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(cors());
  app.use(morgan("combined"));

  app.post("/events", async (req, res) => {
    try {
      const events = req.body;
      await client.connect();
      await client.rPush("events", JSON.stringify(events));
      await client.disconnect();
      await axios.post("http://localhost:4000/events", events);
      await axios.post("http://localhost:4001/events", events);
      await axios.post("http://localhost:4002/events", events);
      await axios.post("http://localhost:4003/events", events);
      return res.send("ok");
    } catch (err) {
      console.error(err);
    }
  });

  app.get("/events", async (req, res) => {
    try {
      const startIndex = 0;
      const lastIndex = -1;
      await client.connect();
      let result = await client.lRange("events", startIndex, lastIndex);
      await client.disconnect();
      result = result.map((ele) => {
        return JSON.parse(ele);
      });
      return res.send(result);
    } catch (err) {
      console.error(err);
    }
  });

  callback();
}

bootstrap(() => {
  app.listen(5000, () => {
    console.log("Event bus started on port 5000");
  });
});
