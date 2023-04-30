const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("redis");
const axios = require("axios");
const EventEmitter = require("events");

const app = express();

const client = createClient();

const eventBus = new EventEmitter();

client.on("error", (err) => console.log("Redis Client Error", err));
client.on("ready", () => console.log("Redis Client is connected"));

async function applmiddlewareAndRoutes(callback) {
  // Use security middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(cors());
  app.use(morgan("combined"));

  eventBus.on("post-create-event", async (data) => {
    try {
      await axios.post("http://localhost:5000/events", {
        data: { ...JSON.parse(data) },
        type: "postCreated",
      });
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/posts", async (req, res) => {
    try {
      const uuid = uuidv4();
      const { title, content } = req.body;
      const contentData = { id: uuid, title, content };
      await client.connect();
      await client.rPush("posts", JSON.stringify(contentData));
      await client.disconnect();
      eventBus.emit("post-create-event", JSON.stringify(contentData));
      res.status(201).send("post created");
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/events", async (req, res) => {
    try {
      res.send("ok");
    } catch (err) {
      console.error(err);
    }
  });

  callback();
}

applmiddlewareAndRoutes(function bootstrap() {
  app.listen(4000, () => {
    console.log("post-service started on port 4000");
  });
});
