const express = require("express");
const app = express();

// Raw body capture for debugging
app.use("/api/auth/login", (req, res, next) => {
  let rawBody = "";
  req.on("data", chunk => {
    rawBody += chunk.toString();
  });
  req.on("end", () => {
    console.log("RAW BODY RECEIVED:", rawBody);
    console.log("RAW BODY LENGTH:", rawBody.length);
    console.log("CHAR AT 59:", rawBody.charCodeAt(59), "=", rawBody[59]);
    res.json({debug: "body logged"});
  });
});

app.listen(4001, () => console.log("Debug server on 4001"));
