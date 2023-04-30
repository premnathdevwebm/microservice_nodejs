const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const EventEmitter = require("events");

const app = express();

const eventBus = new EventEmitter();

async function applmiddlewareAndRoutes(callback) {
  // Use security middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(cors());
  app.use(morgan("combined"));

  eventBus.on("comment-moderate-event", async (data) => {
    try {
      await axios.post("http://localhost:5000/events", {
        data: { ...JSON.parse(data) },
        type: "commentModerated",
      });
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/events", async (req, res) => {
    try {
      let status;
      const { data, type } = req.body;

      if (type === "commentCreated") {
        const regex = /\borange\b/i;
        const comment = data[`${Object.keys(data).length - 1}`].comment;
        if (regex.test(comment)) {
          status = "rejected";
        } else {
          status = "approved";
        }
        data[`${Object.keys(data).length - 1}`].status = status;
        eventBus.emit(
          "comment-moderate-event",
          JSON.stringify(data[`${Object.keys(data).length - 1}`])
        );
      }

      res.send("ok");
    } catch (err) {
      console.error(err);
    }
  });

  callback();
}

applmiddlewareAndRoutes(function bootstrap() {
  app.listen(4002, () => {
    console.log("moderation-service started on port 4002");
  });
});
