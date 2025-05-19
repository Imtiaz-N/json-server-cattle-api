const jsonServer = require("json-server");
const jwt = require("jsonwebtoken");
const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();
const SECRET_KEY = "SECRET_KEY";
const path = require("path");
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");

server.use("/images", (req, res, next) => {
  express.static(path.join(__dirname, "public"))(req, res, next);
});
server.use(middlewares);
server.use(jsonServer.bodyParser);
server.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/img/",
  })
);

// Login endpoint
server.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = router.db.get("users").find({ username, password }).value();

  if (user) {
    const token = jwt.sign({ userId: user.id }, SECRET_KEY, {
      expiresIn: "1h",
    });
    res.json({ token });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

// Logout endpoint (just for mock purposes)
server.post("/auth/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// JWT verification middleware
server.use((req, res, next) => {
  if (
    req.path === "/auth/login" ||
    req.path === "/auth/logout" ||
    req.path.startsWith("/images")
  ) {
    return next();
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    jwt.verify(token, SECRET_KEY);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
});

server.post("/cattle", (req, res) => {
  if (!req.files || !req.files.image) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const image = req.files.image;
  const uploadPath = path.join(__dirname, "public/images", image.name);

  image.mv(uploadPath, (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    const newCattle = {
      id: Date.now(),
      breed: req.body.breed,
      weight: Number(req.body.weight),
      price: Number(req.body.price),
      status: req.body.status,
      image: `images/${image.name}`,
    };

    router.db.get("cattle").push(newCattle).write();
    res.status(201).json(newCattle);
  });
});

server.patch("/cattle/:id", (req, res) => {
  const cattleId = Number(req.params.id);
  const existingCattle = router.db.get("cattle").find({ id: cattleId }).value();

  if (!existingCattle) {
    return res.status(404).json({ error: "Cattle not found" });
  }

  let updatedData = {};

  // Handle file upload if image is being updated
  if (req.files && req.files.image) {
    const image = req.files.image;
    const uploadPath = path.join(__dirname, "public/images", image.name);

    image.mv(uploadPath, (err) => {
      if (err) {
        return res.status(500).send(err);
      }

      updatedData = {
        breed: req.body.breed,
        weight: Number(req.body.weight),
        price: Number(req.body.price),
        status: req.body.status,
        image: `images/${image.name}`,
      };

      router.db
        .get("cattle")
        .find({ id: cattleId })
        .assign(updatedData)
        .write();
      res.json(updatedData);
    });
  } else {
    // If no new image, just update other fields
    updatedData = {
      breed: req.body.breed,
      weight: Number(req.body.weight),
      price: Number(req.body.price),
      status: req.body.status,
    };

    router.db.get("cattle").find({ id: cattleId }).assign(updatedData).write();
    res.json(updatedData);
  }
});

server.use(router);
server.use(cors());

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`JSON Server is running on port ${PORT}`);
});
