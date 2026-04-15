require('dotenv').config()

const express = require("express");
const handlebars = require("express-handlebars");
const session = require('express-session');
const app = express();
const path = require('path');

const db_query = require(path.join(__dirname,'routes/database/db_connection'));
const { getLikeInfo } = require("./routes/database/likeHelper");







const port = process.env.EXPRESS_PORT || 3000;

// Logging in
app.use(session({
    secret: '#32456', //  a random string
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Session expires in 1 hour
}));




app.use(( req, res, next) => {
    // This makes 'isLoggedIn' available in every Handlebars template
    res.locals.isLoggedIn = req.session.isLoggedIn;
    next();
});


app.engine("handlebars", handlebars.create({
    defaultLayout: "main"
}).engine);

app.set("view engine", "handlebars");


app.use(express.urlencoded({ extended: true, limit: '450mb' }));
app.use(express.json({ limit: '450mb' }));

// Blog App Handling Routes
app.get("/", async function (req, res) {
    try {
        let loggedStatus = false;
        let user = null;
        let img = null;

        if (req.session.isLoggedIn && req.session.user) {
            loggedStatus = true;
            user = req.session.user;

            const avatarRows = await db_query.queryData(
                `SELECT image 
         FROM wb_avatar 
         WHERE avatarid IN (
           SELECT avatarid FROM wb_user_details WHERE userid = ?
         )`,
                [user]
            );

            if (avatarRows.length > 0) {
                img = `data:image/png;base64,${avatarRows[0].image.toString("base64")}`;
            }
        }

        // Get all blogs
        const blogcontent = await db_query.queryData(
            `SELECT blogid, ownedby, blogtitle, blogdatetime 
       FROM sp959.wb_blog_metadata
       ORDER BY blogdatetime DESC`
        );

        const rowsblog = await Promise.all(
            blogcontent.map(async element => {
                const likeInfo = await getLikeInfo(
                    element.blogid,
                    req.session.user
                );

                return {
                    blogid: element.blogid,
                    username: element.ownedby,
                    title: element.blogtitle,
                    date: element.blogdatetime,
                    likeCount: likeInfo.likeCount,
                    userLiked: likeInfo.userLiked
                };
            })
        );

        res.render("blogcontent/homepage", {
            loggedStatus,
            user,
            image: img,
            blogPublished: rowsblog
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Homepage error");
    }
});

// Setup routes
const account = require("./routes/account_route.js");
app.use("/account", account);

const blog = require("./routes/homepage_route.js");
app.use("/homepage", blog);


app.listen(port, function () {
    console.log(`Web final project listening on http://localhost:${port}/`);
});
