const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

mongoose
  .connect("mongodb://localhost/myapp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err));

const schema = new mongoose.Schema({
  postId: String,
  title: String,
  content: String,
  comment: [
    {
      id: String,
      content: String,
      status: String,
      vote: Number,
      promote: Number,
      anonymize: Boolean,
      searchable: Boolean,
      advertized: Boolean,
    },
  ],
});

const Blog = mongoose.model("Blog", schema);

const app = express();

function applmiddlewareAndRoutes(callback) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(cors());
  app.use(morgan("combined"));

  app.get("/posts", async (req, res) => {
    try {
      const result = await Blog.find().lean();
      res.send(result);
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/events", async (req, res) => {
    try {
      const { data, type } = req.body;
      if (type === "postCreated") {
        const blog = new Blog({
          postId: data.id,
          title: data.title,
          content: data.content,
        });
        await blog.save();
      }
      if (type === "commentCreated") {
        await Blog.findOneAndUpdate(
          { postId: data[`${Object.keys(data).length - 1}`].postId },
          {
            $push: {
              comment: {
                id: data[`${Object.keys(data).length - 1}`].id,
                content: data[`${Object.keys(data).length - 1}`].comment,
                status: data[`${Object.keys(data).length - 1}`].status,
              },
            },
          }
        );
      }
      if (type === "commentModerated") {
        await Blog.findOneAndUpdate(
          { postId: data.postId },
          { $set: { "comment.$[lastComment].status": data.status } },
          { arrayFilters: [{ 'lastComment.id': data.id }] },
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
  app.listen(4003, () => {
    console.log("query-service started on port 4003");
  });
});
