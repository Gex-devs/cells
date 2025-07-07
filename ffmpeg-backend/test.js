const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors()); // Allows all origins by default
app.use(express.json());
app.use(
  cors({
    origin: "*", // or your React app URL
    methods: ["GET", "OPTIONS", "POST"],
    allowedHeaders: ["Range", "Content-Type"],
  })
);


app.get("/video", (req, res) => {
  const myinput = req.query.input;
  const ffmpegPath = "ffmpeg";

  const match = myinput.match(/\/([^\/\?]+?\.[^\/\?]+)(?:\?|$)/);
  const filename = match ? decodeURIComponent(match[1]) : null;

  fs.mkdir("public/hls/" + filename, { recursive: true }, (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });

  const outputPath = path.resolve(
    __dirname,
    "public/hls/" + filename + "/playlist.m3u8"
  );

  console.log("outputPath", outputPath);
  // Delete old file if exists
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const ffmpeg = spawn(ffmpegPath, [
    "-hwaccel",
    "cuda",
    "-i",
    myinput,
    "-c:v",
    "h264_nvenc",
    "-preset",
    "p4",
    "-rc",
    "vbr",
    "-cq",
    "19",
    "-b:v",
    "2M",
    "-maxrate",
    "3M",
    "-bufsize",
    "4M",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_list_size",
    "0",
    "-hls_playlist_type",
    "event",
    outputPath,
  ]);

  let sent = false;

  // Watch the output file until it exists
  fs.watchFile(outputPath, { interval: 500 }, (curr, prev) => {
    if (curr.size > 0 && !sent) {
      sent = true;
      fs.unwatchFile(outputPath);
      console.log("Playlist created, sending response");
      res.send("/hls/" + filename + "/playlist.m3u8");
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    console.error(`[ffmpeg stderr]: ${data}`);
  });

  ffmpeg.stdout.on("data", (data) => {
    console.log(`[ffmpeg stdout]: ${data.toString()}`);
  });

  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg exited with code ${code}`);
    // if (!sent) {
    //   res.status(500).send("Failed to create playlist");
    // }
  });

  req.on("close", () => {
    // ffmpeg.kill("SIGINT");
  });
});

app.use("/hls", express.static(path.join(__dirname, "public/hls")));

app.listen(3001, () => {
  console.log("FFmpeg backend running on port 3001");
});
