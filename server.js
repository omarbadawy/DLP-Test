import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads + index.html)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(__dirname));

// Ensure uploads folder exists
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

// ===== Multer for file uploads =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ===== Routes =====

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Generic echo API
app.all("/api", (req, res) => {
  console.log(`📩 [${req.method}] /api`);
  console.log("Query:", req.query);
  console.log("Body:", req.body);

  res.json({
    message: "Echo from server",
    method: req.method,
    query: req.query,
    body: req.body
  });
});

// Upload via POST (fetch or form)
app.post("/upload", upload.single("file"), (req, res) => {
  console.log("📂 File uploaded via POST:", req.file?.originalname);
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ message: "File uploaded successfully", fileUrl });
});

// Upload via GET with base64 query
app.get("/upload-get", (req, res) => {
  const { filename, data } = req.query;
  if (!filename || !data) {
    return res.status(400).json({ error: "Missing filename or data" });
  }

  try {
    const buffer = Buffer.from(data, "base64");
    const safeName = Date.now() + "-" + filename;
    const filepath = path.join(__dirname, "uploads", safeName);
    fs.writeFileSync(filepath, buffer);
    console.log("📂 File uploaded via GET:", filename);

    const fileUrl = `http://localhost:${PORT}/uploads/${safeName}`;
    res.json({ message: "File uploaded successfully (GET base64)", fileUrl });
  } catch (err) {
    console.error("❌ Error saving base64 file:", err);
    res.status(500).json({ error: "Failed to save file" });
  }
});

// ===== WebSocket Server =====
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔗 WebSocket client connected");

  let currentFilename = null;


ws.on("message", (message, isBinary) => {
  if (!isBinary) {
    try {
      const meta = JSON.parse(message.toString());
      if (meta.filename) {
        currentFilename = Date.now() + "-" + meta.filename;
        return;
      }
    } catch {
      // Regular text
      const text = message.toString();
      console.log("💬 WS Text:", text);
      ws.send(JSON.stringify({ echo: text }));
    }
  } else {
    // Save file with original extension
    const filename = currentFilename || `ws-${Date.now()}.bin`;
    const filepath = path.join(__dirname, "uploads", filename);
    fs.writeFileSync(filepath, message);
    console.log("📂 File uploaded via WS:", filename);

    const fileUrl = `http://localhost:${PORT}/uploads/${filename}`;
    ws.send(JSON.stringify({ message: "File uploaded via WS", fileUrl }));

    currentFilename = null;
  }
});


  ws.on("close", () => {
    console.log("❌ WebSocket client disconnected");
  });
});
