// Add this at the top
const path = require('path');
const dotenv = require("dotenv").config({
    path:  path.join(__dirname,'db.env') 
});
const mariadb = require("mariadb");

console.log("Environment file path:", path.join(__dirname, 'db.env'));
console.log("DB_HOST loaded:", process.env.DB_HOST);

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306
});

async function queryData(query, params = []) {
    let connection;

    try {
        connection = await pool.getConnection();
        console.log("Database connected successfully!");
        return await connection.query(query, params);
    } catch(err) {
        console.error("Database query error:", err.message);
        return null;
    } finally {
        if (connection) connection.release();
    }

}

module.exports = { queryData };