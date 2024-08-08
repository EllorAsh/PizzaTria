
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

let inCart=0;

app.get("/", (req, res)=>{
  res.render("home.ejs",{
    cartItems:inCart
  })
});

app.get("/home", (req, res)=>{
    res.render("home.ejs",{
        cartItems:inCart
      })
});

app.get("/menu", async (req, res)=>{
    const Pizzas= await getPizzas();
    res.render("menu.ejs",{
        pizzas:Pizzas,
        cartItems:inCart
    })
});

app.post("/pizzaview", async (req, res)=>{
    const pizzaId = req.body["PizzaId"];
    const pizza=await returnPizzaInfo(pizzaId)
    console.log(req.body);
    console.log(pizza)
     res.render("pizzaview.ejs",{
        pizza:pizza,
        cartItems:inCart
     });
})
app.post("/order", async(req, res)=>{
    inCart=inCart+1;
    const pizzaId = req.body["PizzaId"];
    const pizza=await returnPizzaInfo(pizzaId)
    const pizzafororder=req.body
    placePizzaToOrder(pizzafororder)
    res.render("pizzaview.ejs",{
        pizza:pizza,
        cartItems:inCart
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

async function placePizzaToOrder(pizza) {
    let additionalToppings= []
    let additionalToppingsPrice=0
    if(pizza.ExtraCheese){
        additionalToppings.push("Extra Cheese")
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.ExtraCheese)
    }
    if(pizza.Jalapeno){
        additionalToppings.push("Jalapeno")
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Jalapeno)
    }
    if(pizza.Mushrooms){
        additionalToppings.push("Mushrooms")
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Mushrooms)
    }
    if(pizza.Olives){
        additionalToppings.push("Olives")
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Olives)
    }
    if(pizza.Bacon){
        additionalToppings.push("Bacon")
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Bacon)
    }
    if(pizza.Chicken){
        additionalToppings.push("Chicken")
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Chicken)
    }
    if(pizza.FetaCheese){
        additionalToppings.push("FetaCheese")
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.FetaCheese)
    }
    if(pizza.Peperoni){
        additionalToppings.push("Peperoni")
        additionalToppingsPrice=additionalToppingsPrice+parseFloat(pizza.Peperoni)
    }
    if(pizza.Avocado){
        additionalToppings.push("Avocado")
        additionalToppingsPrice=additionalToppingsPrice+parseFloat(pizza.Avocado)
    }
    const result = await db.query("SELECT * FROM pizzas WHERE id=($1)",[pizza.PizzaId]);
    const orderedPizzaName = result.rows[0].name
    const orderedPizzaPrice= result.rows[0].price

    const totalPriceForPizza=orderedPizzaPrice+additionalToppingsPrice

    console.log(additionalToppings,additionalToppingsPrice , orderedPizzaName, orderedPizzaPrice, pizza.BaseType, totalPriceForPizza)
}