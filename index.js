
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
let orderPlaced = 0

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
        const user = req.user.email
        const inCart =await getCartItems(user)
        console.log(req.user.email)
        res.render("home.ejs",{
            cartItems:inCart
        })
    } else {
        res.redirect("/login");
    }

});

app.get("/menu", async (req, res)=>{
    if (req.isAuthenticated()) {
        const user = req.user.email
        const Pizzas= await getPizzas();
        const inCart =await getCartItems(user)
        res.render("menu.ejs",{
            pizzas:Pizzas,
            cartItems:inCart
        })
    }else{
        res.redirect("/login")
    }
});

app.post("/pizzaview", async (req, res)=>{
    if (req.isAuthenticated()) {
        const user = req.user.email
        const pizzaId = req.body["PizzaId"];
        const pizza=await returnPizzaInfo(pizzaId);
        const toppings = await getAdditionalToppings();
        console.log(req.body);
        console.log(pizza)
        const inCart =await getCartItems(user)
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
    if (req.isAuthenticated()) {
        const pizzaId = req.body["PizzaId"];
        const pizza=await returnPizzaInfo(pizzaId)
        const toppings = await getAdditionalToppings();
        const pizzafororder=req.body
        const user = req.user.email
        console.log(user)
        placePizzaToOrder(pizzafororder, user)
        let inCart =await getCartItems(user)
        inCart=inCart+1
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
    if (req.isAuthenticated()) {
        const user = req.user.email
        const orderP = orderPlaced
        orderPlaced =0;
        const order = await getOrder(user)
        const inCart =await getCartItems(user)
        const total = await getOrderTotal(user)
        res.render("checkout.ejs",{
            cartItems:inCart,
            orderPizzas:order,
            orderTotal:total,
            orderPlaced:orderP,
        })
    }else{
        res.redirect("/login")
    }
})

app.get("/profile", async(req, res)=>{
    if (req.isAuthenticated()) {
        const user = req.user.email
        const inCart =await getCartItems(user)
        res.render("profile.ejs",{
            cartItems:inCart,
        })
    }else{
        res.redirect("/login")
    }
})

app.post("/placeOrder", async(req, res)=>{
  if (req.isAuthenticated()) {
    const user = req.user.email
    let orderInfo = req.body
    const total = await getOrderTotal(user) 
    placeOrder(user, total, orderInfo)
    orderPlaced=1;
    res.redirect("checkout")
  }else{
    res.redirect("/login")
  }

})

app.post("/deletePizza", async(req, res)=>{
  if (req.isAuthenticated()) {
    let orderId = req.body.order_id
    deletePizza(orderId)
    res.redirect("checkout")
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

async function deletePizza(order_id) {
  await db.query("DELETE FROM currentorderinfo WHERE id = ($1)",[order_id])
}

async function placeOrder(user, total, order){
  const result = await db.query("SELECT * FROM currentorderinfo WHERE useremail = ($1)",[user]);
  const users = await db.query("SELECT * FROM users WHERE email =($1)", [user])
  let pizzas =[]
  let userId = 0
  result.rows.forEach((pizza)=>{
    pizzas.push(pizza.pizza_name)
  })
  if(users.rows.length > 0){
    users.rows.forEach(u=>{
        userId = u.id
    });        
  } 
  let deliveryMethod = order.deliveryM;
  let tax = total * 0.15;
  let orderTotal = total + tax;
  let additionalNotes = order.AdditionalNote;
  console.log("Order Placed with pizzas: "+ pizzas + " order total: " + orderTotal + " the order will be for "+ deliveryMethod + " user: "+ userId+ " left additional notes: "+ additionalNotes )
  await db.query("INSERT INTO orders (pizzas, delivery_method, cost_before_tax, total_tax, cost_after_tax, order_user_id) Values ($1, $2, $3, $4, $5, $6 )",[pizzas, deliveryMethod, total, tax, orderTotal, userId]);
  await db.query("DELETE FROM currentorderinfo WHERE useremail = ($1)",[user])
}



async function getCartItems(user){
    const result = await db.query("SELECT * FROM currentorderinfo WHERE useremail = ($1)",[user]);
    return(result.rows.length);
}
async function getOrder(user) {
    let orders=[]
    const result = await db.query("SELECT * FROM currentorderinfo WHERE useremail = ($1)",[user]);
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

async function placePizzaToOrder(pizza, user) {
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
    await db.query("INSERT INTO currentorderinfo (pizza_id, pizza_name, base_type, additional_toppings, additional_toppings_price, pizza_price, total_price_for_pizza, useremail) Values ($1, $2, $3, $4, $5, $6, $7, $8)",[pizza.PizzaId, orderedPizzaName, pizza.BaseType, additionalToppings, additionalToppingsPrice, orderedPizzaPrice,totalPriceForPizza, user]);
    console.log("Pizza added to order.")
}

async function getOrderTotal(user) {
    let OrderTotal=0;
    const result = await db.query("SELECT * FROM currentorderinfo WHERE useremail = ($1)",[user]);
    if(result.rows.length > 0){
        result.rows.forEach(order=>{
            OrderTotal = OrderTotal+order.total_price_for_pizza
        });        
    }
    return OrderTotal
}