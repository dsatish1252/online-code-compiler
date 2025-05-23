require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const getCodes = async () => {
  try {
    const result = await pool.query(
      "SELECT filename, code, language from codes"
    );
    return result.rows;
  } catch (error) {
    console.log("error: error");
    return [];
  }
};

app.get("/", async (req, res) => {
  res.render("index", {
    message: null,
    codeFiles: await getCodes(),
  });
});

app.post("/view-file", async (req, res) => {
  const { filename } = req.body;
  try {
    const result = await pool.query("SELECT * FROM codes WHERE filename = $1", [
      filename,
    ]);
    if (result.rows.length > 0) {
      res.json({
        success: true,
        code: result.rows[0].code,
        language: result.rows[0].language,
      });
    } else {
      res.json({ success: false, message: "File not found" });
    }
  } catch (error) {
    res.json({ success: false, message: "Error fetching file" });
  }
});

app.post("/save", async (req, res) => {
  const { filename, code, language } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO codes (filename, code, language) VALUES($1, $2, $3) RETURNING *",
      [filename, code, language]
    );

    if (result.rows[0]) {
      res.render("index", {
        message: "File saved successfully",
        codeFiles: await getCodes(),
      });
    } else {
      res.render("index", { message: "File not saved" });
    }
  } catch (error) {
    console.error(error);
    res.render("index", { message: "Error while saving file" });
  }
});

app.post("/compile", async (req, res) => {
  const { code, languageId, input } = req.body;

  try {
    const response = await axios.post(
      `${process.env.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: code,
        stdin: input,
        language_id: languageId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Host": process.env.RAPIDAPI_HOST,
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        },
      }
    );
    console.log(response.data);

    res.json({
      stdout: response.data.stdout,
      stderr: response.data.stderr,
      compile_output: response.data.compile_output,
    });
  } catch (err) {
    res.status(500).json({ error: "Error compiling code" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
