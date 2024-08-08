
import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import env from "dotenv";

env.config();
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
  
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

app.get("/menu", async (req, res)=>{
    const Pizzas= await getPizzas();
    res.render("menu.ejs",{
        pizzas:Pizzas
    })
});

app.post("/pizzaview", async (req, res)=>{
    const pizzaId = req.body["PizzaId"];
    const pizza=await returnPizzaInfo(pizzaId)
    console.log(req.body);
    console.log(pizza)
     res.render("pizzaview.ejs",{
        pizza:pizza
     });
})


app.listen(port, ()=>{
  console.log("Server running on port "+ port);
})

// Functions
async function getPizzas(){
    const result = await db.query("SELECT * FROM pizzas");
    let allPizzas = [];
    result.rows.forEach((pizza) => {
        allPizzas.push(pizza);
    });
    return allPizzas;
}

async function returnPizzaInfo(id){
    const result = await db.query("SELECT * FROM pizzas WHERE id=($1)",[id]);
    return(result.rows[0])
}