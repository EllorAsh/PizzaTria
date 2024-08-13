
import express from "express";
import pg from "pg";
import bodyParser from "body-parser";

import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import GoogleStrategy from "passport-google-oauth2";

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
const saltRounds = 10;

app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
    })
);

app.use(express.static("./public"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(passport.initialize());
app.use(passport.session());

app.get("/auth/google", passport.authenticate("google",{
    scope:["profile","email"],
}))

app.get("/", async(req, res)=>{
    res.render("login.ejs")
});

app.get("/login", async(req, res)=>{
    res.render("login.ejs")
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post(
    "/login",
    passport.authenticate("local", {
      successRedirect: "/home",
      failureRedirect: "/login",
    })
);
app.get("/auth/google/secrets", passport.authenticate("google", {
    successRedirect: "/home",
    failureRedirect: "/login",
}));

app.get("/home", async(req, res)=>{
    if (req.isAuthenticated()) {
        const inCart =await getCartItems()
        res.render("home.ejs",{
            cartItems:inCart
        })
    } else {
        res.redirect("/login");
    }

});

app.get("/menu", async (req, res)=>{
    const Pizzas= await getPizzas();
    const inCart =await getCartItems()
    if (req.isAuthenticated()) {
        res.render("menu.ejs",{
            pizzas:Pizzas,
            cartItems:inCart
        })
    }else{
        res.redirect("/login")
    }
});

app.post("/pizzaview", async (req, res)=>{
    const pizzaId = req.body["PizzaId"];
    const pizza=await returnPizzaInfo(pizzaId);
    const toppings = await getAdditionalToppings();
    console.log(req.body);
    console.log(pizza)
    const inCart =await getCartItems()
    if (req.isAuthenticated()) {
        res.render("pizzaview.ejs",{
            pizza:pizza,
            cartItems:inCart,
            toppings:toppings
        });
    }else{
        res.redirect("login")
    }
})
app.post("/order", async(req, res)=>{
    const pizzaId = req.body["PizzaId"];
    const pizza=await returnPizzaInfo(pizzaId)
    const toppings = await getAdditionalToppings();
    const pizzafororder=req.body
    placePizzaToOrder(pizzafororder)
    let inCart =await getCartItems()
    inCart=inCart+1
    if (req.isAuthenticated()) {
        res.render("pizzaview.ejs",{
            pizza:pizza,
            cartItems:inCart,
            toppings:toppings
        });
    }else{
        res.redirect("/login")
    }
})

app.get("/checkout", async(req, res)=>{
    const order = await getOrder()
    const inCart =await getCartItems()
    const total = await getOrderTotal()
    if (req.isAuthenticated()) {
        res.render("checkout.ejs",{
            cartItems:inCart,
            orderPizzas:order,
            orderTotal:total
        })
    }else{
        res.redirect("/login")
    }
})
  
  app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
  
    try {
      const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
  
      if (checkResult.rows.length > 0) {
        req.redirect("/login");
      } else {
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
          } else {
            const result = await db.query(
              "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
              [email, hash]
            );
            const user = result.rows[0];
            req.login(user, (err) => {
              console.log("success");
              res.redirect("/secrets");
            });
          }
        });
      }
    } catch (err) {
      console.log(err);
    }
  });
  
  passport.use("local",
    new Strategy(async function verify(username, password, cb) {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
          username,
        ]);
        if (result.rows.length > 0) {
          const user = result.rows[0];
          const storedHashedPassword = user.password;
          bcrypt.compare(password, storedHashedPassword, (err, valid) => {
            if (err) {
              //Error with password check
              console.error("Error comparing passwords:", err);
              return cb(err);
            } else {
              if (valid) {
                //Passed password check
                return cb(null, user);
              } else {
                //Did not pass password check
                return cb(null, false);
              }
            }
          });
        } else {
          return cb("User not found");
        }
      } catch (err) {
        console.log(err);
      }
    })
  );
  
  passport.use("google", new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:"http://localhost:3000/auth/google/secrets",
    userProfileURL:"http://www.googleapis.com/oauth2/v3/userinfo"
  }, async (accessToken, refreshToken, profile, cb)=>{
    console.log(profile);
    try{
      const result =await db.query("SELECT * FROM users WHERE email = $1", [profile.email])
      if(result.rows.length === 0){
        //set password as google in database to show that this is a user logged in with google.
        //do not get password from google.
        const newUser = await db.query("INSERT INTO users (email, password) VALUES ($1, $2)", [profile.email, "google"])
        cb(null, newUser.rows[0]);
      }else{
        //Already existing user
        cb(null, result.rows[0]);
      }
    }catch(err){
      cb(err);
    }
  })
  );
  
  passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });
  

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

async function login(userEmail, userPassword) {
    const result = await db.query("SELECT * FROM users WHERE userEmail = ($1)",[userEmail]);
}