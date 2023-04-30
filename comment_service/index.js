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

  eventBus.on("comment-create-event", async (data) => {
    try {
      await axios.post("http://localhost:5000/events", {
        data: { ...JSON.parse(data) },
        type: "commentCreated",
      });
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/posts/:id/comments", async (req, res) => {
    try {
      const uuid = uuidv4();
      const { id } = req.params;
      const { comment } = req.body;
      const contentData = {
        id: uuid,
        postId: id,
        comment,
        status: "pending",
      };
      await client.connect();
      const temp = (await client.hGet("comments", `${id}`))
        ? JSON.parse(await client.hGet("comments", `${id}`))
        : [];
      temp.push(contentData);
      eventBus.emit("comment-create-event", JSON.stringify(temp));
      await client.hSet("comments", `${id}`, JSON.stringify(temp));
      await client.disconnect();
      res.status(201).send("comments created");
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/events", async (req, res) => {
    try {
      const { data, type } = req.body;
      if (type === "commentModerated") {
        await client.connect();
        let temp = await client.hGet("comments", `${data.postId}`);
        temp = JSON.parse(temp);
        temp[`${Object.keys(temp).length - 1}`] = data;
        await client.hSet("comments", `${data.postId}`, JSON.stringify(temp));
        await client.disconnect();
      }
      res.send("ok");
    } catch (err) {
      console.error(err);
    }
  });

  callback();
}

applmiddlewareAndRoutes(function bootstrap() {
  app.listen(4001, () => {
    console.log("comment-service started on port 4001");
  });
});
