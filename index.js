
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

app.get("/", async(req, res)=>{
    const inCart =await getCartItems()
    res.render("home.ejs",{
    cartItems:inCart
  })
});

app.get("/home", async(req, res)=>{
    const inCart =await getCartItems()
    res.render("home.ejs",{
        cartItems:inCart
      })
});

app.get("/menu", async (req, res)=>{
    const Pizzas= await getPizzas();
    const inCart =await getCartItems()
    res.render("menu.ejs",{
        pizzas:Pizzas,
        cartItems:inCart
    })
});

app.post("/pizzaview", async (req, res)=>{
    const pizzaId = req.body["PizzaId"];
    const pizza=await returnPizzaInfo(pizzaId);
    const toppings = await getAdditionalToppings();
    console.log(req.body);
    console.log(pizza)
    const inCart =await getCartItems()
     res.render("pizzaview.ejs",{
        pizza:pizza,
        cartItems:inCart,
        toppings:toppings
     });
})
app.post("/order", async(req, res)=>{
    const pizzaId = req.body["PizzaId"];
    const pizza=await returnPizzaInfo(pizzaId)
    const toppings = await getAdditionalToppings();
    const pizzafororder=req.body
    placePizzaToOrder(pizzafororder)
    let inCart =await getCartItems()
    inCart=inCart+1
    res.render("pizzaview.ejs",{
        pizza:pizza,
        cartItems:inCart,
        toppings:toppings
    });
})

app.get("/checkout", async(req, res)=>{
    const order = await getOrder()
    const inCart =await getCartItems()
    const total = await getOrderTotal()
    res.render("checkout.ejs",{
        cartItems:inCart,
        orderPizzas:order,
        orderTotal:total
    })
})


app.listen(port, ()=>{
  console.log("Server running on port "+ port);
})

// Functions
async function getCartItems(){
    const result = await db.query("SELECT * FROM currentorderinfo");
    return(result.rows.length);
}
async function getOrder() {
    let orders=[]
    const result = await db.query("SELECT * FROM currentorderinfo");
    if(result.rows.length > 0){
        result.rows.forEach(order=>{
            orders.push(order);
        });        
    }
    return orders
}

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

async function getAdditionalToppings() {
    const result = await db.query("SELECT * FROM additionaltoppings");
    let toppings =[]
    result.rows.forEach((topping)=>{
        toppings.push(topping)
    });
    return toppings;
}

async function placePizzaToOrder(pizza) {
    let additionalToppings= ""
    let additionalToppingsPrice=0
    if(pizza.ExtraCheese){
        additionalToppings=additionalToppings+ " Extra Cheese"
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.ExtraCheese)
    }
    if(pizza.Jalapeno){
        additionalToppings=additionalToppings+ " Jalapeno"
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Jalapeno)
    }
    if(pizza.Mushrooms){
        additionalToppings=additionalToppings+ " Mushrooms"
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Mushrooms)
    }
    if(pizza.Olives){
        additionalToppings=additionalToppings+" Olives"
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Olives)
    }
    if(pizza.Bacon){
        additionalToppings=additionalToppings+ " Bacon"
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Bacon)
    }
    if(pizza.Chicken){
        additionalToppings=additionalToppings+ " Chicken"
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.Chicken)
    }
    if(pizza.FetaCheese){
        additionalToppings=additionalToppings+ " Feta Cheese"
        additionalToppingsPrice=additionalToppingsPrice+parseInt(pizza.FetaCheese)
    }
    if(pizza.Peperoni){
        additionalToppings=additionalToppings+ " Peperoni"
        additionalToppingsPrice=additionalToppingsPrice+parseFloat(pizza.Peperoni)
    }
    if(pizza.Avocado){
        additionalToppings=additionalToppings+ " Avocado"
        additionalToppingsPrice=additionalToppingsPrice+parseFloat(pizza.Avocado)
    }
    const result = await db.query("SELECT * FROM pizzas WHERE id=($1)",[pizza.PizzaId]);
    const orderedPizzaName = result.rows[0].name
    const orderedPizzaPrice= result.rows[0].price

    const totalPriceForPizza=orderedPizzaPrice+additionalToppingsPrice

    console.log(additionalToppings,additionalToppingsPrice , orderedPizzaName, orderedPizzaPrice, pizza.BaseType, totalPriceForPizza)
    await db.query("INSERT INTO currentorderinfo (pizza_id, pizza_name, base_type, additional_toppings, additional_toppings_price, pizza_price, total_price_for_pizza) Values ($1, $2, $3, $4, $5, $6, $7)",[pizza.PizzaId, orderedPizzaName, pizza.BaseType, additionalToppings, additionalToppingsPrice, orderedPizzaPrice,totalPriceForPizza]);
    console.log("Pizza added to order.")
}

async function getOrderTotal() {
    let OrderTotal=0;
    const result = await db.query("SELECT * FROM currentorderinfo");
    if(result.rows.length > 0){
        result.rows.forEach(order=>{
            OrderTotal = OrderTotal+order.total_price_for_pizza
        });        
    }
    return OrderTotal
}