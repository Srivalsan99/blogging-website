const express = require("express");
const path = require('path');
const bcrypt = require('bcrypt');

const db_query = require(path.join(__dirname, 'database/db_connection'));
const router = express.Router();

// User Name Check
router.get("/check-username/:userid", async (req, res) => {
    try {
        const userid = req.params.userid;
        const rows = await db_query.queryData(
            "SELECT userid FROM wb_user_details WHERE userid = ?",
            [userid]
        );

        // checking if the name is taken
        res.json({ available: rows.length === 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// Page Navigation for login page
router.get("/login", (req, res) => {
    res.render("account/login");
});

// POST route for login page
router.post("/login", async (req, res) => {
    const { userid, password } = req.body;

    try {
        if (!userid || !password) {
            return res.render("account/login", { loginError: true });
        }

        const rows = await db_query.queryData("SELECT userid, password FROM wb_user_details WHERE userid = ?", [userid]);

        if (rows.length > 0) {
            const user = rows[0];
            const match = await bcrypt.compare(userid + password, user.password);

            if (match) {
                req.session.isLoggedIn = true;
                req.session.user = userid;
                return res.redirect("/");
            }
        }

        return res.render("account/login", { loginError: true });

    } catch (err) {
        console.error(err);
        return res.status(500).send("Server Error");
    }
});

router.get('/logout', (req,res)=>{
    req.session.destroy(() => {
        res.redirect("/");
    });
})

// Page Navigation route
router.get("/create", async (req, res) => {
    try {
        const rows = await db_query.queryData("SELECT * FROM wb_avatar order by avatarid");

        const avatars = rows.map(row => {
            return {
                id: row.avatarid,
                imageData: `data:image/png;base64,${row.image.toString('base64')}`
            };
        });
        res.render("account/create", { avatars, userExistsError: false });

    } catch (err) {
        console.error(err);
        res.render("account/create", { avatars: [] });
    }
});

// POST: /account/create
router.post("/create", async (req, res) => {
    const { avatarid, userid, firstname, lastname, password, rpassword, date, month, year, description } = req.body;

    try {
        // Uniqueness Check of userid
        const existingUser = await db_query.queryData("SELECT userid FROM wb_user_details WHERE userid = ?", [userid])
        const isUserUnique = existingUser.length === 0

        if (!isUserUnique) {
            const rows = await db_query.queryData("SELECT * FROM wb_avatar order by avatarid");
            const avatars = rows.map(row => ({
                id: row.avatarid,
                imageData: `data:image/png;base64,${row.image.toString('base64')}`
            }));

            // Duplicated user
            return res.render("account/create", { 
                avatars, 
                userExistsError: true 
            });
        }

        // Validation Logic setting Block
        const fieldsAreValid = [userid, firstname, lastname, date, month, year, description].every(field => field && field.trim() !== "")
        const useridRegex = /^(?=[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*_,])(?=.*[a-zA-Z]).{5,}$/;

        const isUseridValid = useridRegex.test(userid);
        const isPasswordValid = useridRegex.test(password);

        const d = parseInt(date);
        const m = parseInt(month) - 1;
        const y = parseInt(year);
        const composeDate = new Date(y, m, d);

        const isDateReal = composeDate.getFullYear() === y && 
                           composeDate.getMonth() === m && 
                           composeDate.getDate() === d;

        // Final Check Insert Block
        if (fieldsAreValid && password === rpassword && isUseridValid && isPasswordValid && password !== userid && isDateReal) {
            const saltrounds = 10;
            const hashedPassword = await bcrypt.hash(userid + password, saltrounds);
            
            await db_query.queryData(
                `INSERT INTO wb_user_details (userid, password, real_name, dob, description, avatarid) VALUES (?,?,?,?,?,?)`,
                [userid, hashedPassword, firstname + " " + lastname, composeDate, description, avatarid]
            );
            
            return res.render("account/login", { loginError: false });
        } else {
                return res.render("account/create", { 
                avatars, 
                userExistsError: true 
            });
        }


    } catch (err) {
        console.error(err);
    }
});

module.exports = router;