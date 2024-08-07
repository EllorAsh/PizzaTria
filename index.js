
import express from "express";
import pg from "pg";
import bodyParser from "body-parser";



const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "PizzaTria",
  password: "Ella09088",
  port: "5432",
});
db.connect();
const app = express();
const port = 3000;
app.use(express.static("./public"));
app.use(bodyParser.urlencoded({extended:true}));

app.get("/", (req, res)=>{
  res.render("home.ejs")
});

app.get("/home", (req, res)=>{
    res.render("home.ejs")
});

app.get("/menu", (req, res)=>{
    res.render("menu.ejs")
});


app.listen(port, ()=>{
  console.log("Server running on port "+ port);
})
