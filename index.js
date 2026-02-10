import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

/*


const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "library",
  password: "acmn1994",
  port: 5432,
});
*/
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necesario para conectar con Render
});
const port = process.env.PORT || 3000;
db.connect()


  .then(() => console.log("Connected to database"))
  .catch(err => console.error("Database connection error:", err));




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
    
    const result = await db.query(`
        SELECT
            user_comments.id,
            user_comments.comment,
            user_comments.score,
            user_comments.date_time,
            user_comments.id_book,
            users.user_name,
            information.olid,
            information.title,
            information.autor,
            
            information.cover_id,
            information.calificacion
        FROM user_comments
        JOIN users on users.id_user = user_comments.user_id
        JOIN information on information.id=user_comments.id_book
        WHERE user_comments.id_book =$1`,[bookId]);
   
    const book = result.rows;
    
    
    const urlbook = await axios.get(`https://openlibrary.org/works/${book[0].olid}.json`);
    const rawDescription = urlbook.data.description?.value || urlbook.data.description || "";

    // Limpiar patrones comunes que no queremos
   let description = rawDescription;
    description = description.split("([source][1])")[0];
    description = description.split("[Source][1]")[0];
    description = description.split("Contains:")[0];
    res.render("description.ejs", { book: book, description: description});
});
app.post("/add_comment", async (req, res) => {
    
    const user_name= req.body.user_name;
    const comment = req.body.comment;
    const score = req.body.score;
    const book_id = req.body.id_book;
    const date_time = new Date();
    let user = await db.query("SELECT * FROM users WHERE user_name = $1", [user_name]);
    let userid;
    if (user.rows.length > 0) {
        
        userid = user.rows[0].id_user;
        
    } else {
        const newUser = await db.query("INSERT INTO users (user_name) VALUES ($1) RETURNING id_user", [user_name]);
        userid = newUser.rows[0].id_user;
        
    }


    await db.query("INSERT INTO user_comments (user_id, comment, score, id_book, date_time)" + 
        "VALUES ($1, $2, $3, $4, $5)", [userid, comment, score, book_id, date_time]); 
    
    res.redirect(`/description?bookId=${req.body.id_book}`);
});
app.post("/delete_comment", async (req, res) => {
    
    const commentIds = req.body.commentCheckbox; // Array de IDs de comentarios a eliminar
    const bookId = req.body.id_book; // ID del libro para redirigir después de eliminar
    
    if (!commentIds) {
        return res.redirect(`/description?bookId=${bookId}`); // Redirigir de vuelta si no se seleccionó ningún comentario
    }else if (typeof commentIds === "string") {
        await db.query("DELETE FROM user_comments WHERE id = $1", [commentIds]);
    } else {
        for (const commentId of commentIds) {
            await db.query("DELETE FROM user_comments WHERE id = $1", [commentId]);
        }
    }
    res.redirect(`/description?bookId=${bookId}`); // Redirigir de vuelta a la página de descripción del libro       
  
    
});
app.post("/edit_comment", async (req, res) => {
    
    let allComments = [];
    const commentId = req.body.commentCheckbox;
    const bookId = req.body.id_book;
    const result = await db.query("SELECT * FROM information WHERE id = $1", [bookId]);
    if (!commentId) {
        return res.redirect(`/description?bookId=${bookId}`); // Redirigir de vuelta si no se seleccionó ningún comentario
    }else if (typeof commentId === "string") {
        
        const commentsResult = await db.query(`
            SELECT 
                user_comments.*,
                users.user_name
                FROM user_comments
                JOIN users ON users.id_user= user_comments.user_id
                WHERE id = $1`, [commentId]);
        allComments.push(commentsResult.rows[0])
    } else {
        
         for (const id of commentId) {
            
            const commentsResult = await db.query(`
                SELECT 
                    user_comments.*,
                    users.user_name
                    FROM user_comments
                    JOIN users ON users.id_user= user_comments.user_id
                    WHERE id = $1`, [id]);
           
            allComments.push(commentsResult.rows[0]);
            
        }
    }
   
    const book = result.rows[0];
    
    const urlbook = await axios.get(`https://openlibrary.org/works/${book.olid}.json`);
    const rawDescription = urlbook.data.description?.value || urlbook.data.description || "";

    // Limpiar patrones comunes que no queremos
   let description = rawDescription;
    description = description.split("([source][1])")[0];
    description = description.split("[Source][1]")[0];
    description = description.split("Contains:")[0];
    res.render("edit.ejs", { book: book, description: description, comments: allComments});

});
app.post("/edit",async(req,res)=>{
    const id_book=req.body.id_book
   
       

    for(var i=0; i < req.body.comment.length; i++){
        const user_id=req.body.comment[i].user_id
        const user_name = req.body.comment[i].user_name
        
        await db.query('UPDATE users SET user_name = $1 WHERE id_user = $2 ', [user_name,user_id]);
        
    }
    for(var i=0; i < req.body.comment.length; i++){
      
       
        const comment = req.body.comment[i].comment
        const comment_id=req.body.comment[i].comment_id
        const score = req.body.comment[i].score
        const date = new Date();
        
        await db.query('UPDATE user_comments SET  comment = $1, score= $2, date_time=$3 WHERE id = $4 ', [comment,score,date,comment_id]);
                       
    }
    res.redirect(`/description?bookId=${id_book}`)

    
});

app.post("/redirect",async(req,res)=>{
    console.log(req.body)
    const id_book=req.body.id_book
 
    res.redirect(`/description?bookId=${id_book}`)

    
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
 
});
