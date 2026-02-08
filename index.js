import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";


const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "library",
  password: "acmn1994",
  port: 5432,
});
db.connect();
const bookswithData = [];   

/*
 for (const book of result.rows) {
        const urlbook = await axios.get(`https://openlibrary.org/works/${book.olid}.json`);
        const data = urlbook.data;
        const rawDescription = data.description?.value || data.description || "";

    // Limpiar patrones comunes que no queremos
   let description = rawDescription;
    description = description.split("([source][1])")[0];
    description = description.split("[Source][1]")[0];
    description = description.split("Contains:")[0];
    
    
    }*/
async function getBooks() {
    const result = await db.query("SELECT * FROM information");
   
    return result.rows;
}

app.get("/", async (req, res) => {
  const books = await getBooks();
  
  res.render("index.ejs", { books: books });
});
app.get("/alphabeticalAZ", async (req, res) => {
    const result = await db.query("SELECT * FROM information ORDER BY title ASC");
    res.render("index.ejs", { books: result.rows });
});
app.get("/alphabeticalZA", async (req, res) => {
    const result = await db.query("SELECT * FROM information ORDER BY title DESC");
    res.render("index.ejs", { books: result.rows });
});
app.get("/category", async (req, res) => {
    const result = await db.query("SELECT * FROM information ORDER BY genero ASC");
    res.render("index.ejs", { books: result.rows });
});
app.get("/rating", async (req, res) => {
    const result = await db.query("SELECT * FROM information ORDER BY calificacion DESC");
    res.render("index.ejs", { books: result.rows });
});
app.get("/description", async (req, res) => {
    const bookId = req.query.bookId;
    const result = await db.query("SELECT * FROM information WHERE id = $1", [bookId]);
    const book = result.rows[0];
    const urlbook = await axios.get(`https://openlibrary.org/works/${book.olid}.json`);
    const rawDescription = urlbook.data.description?.value || urlbook.data.description || "";

    // Limpiar patrones comunes que no queremos
   let description = rawDescription;
    description = description.split("([source][1])")[0];
    description = description.split("[Source][1]")[0];
    description = description.split("Contains:")[0];
    res.render("description.ejs", { book: book, description: description });
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
 
});
