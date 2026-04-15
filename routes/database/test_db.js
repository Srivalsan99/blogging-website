const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'db.env') });

console.log("=== Testing Database Connection ===");
console.log("Host:", process.env.DB_HOST);
console.log("User:", process.env.DB_USER);
console.log("Database:", process.env.DB_NAME);

const mariadb = require('mariadb');

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    connectTimeout: 10000
};

async function test() {
    let conn;
    try {
        console.log("\nAttempting connection to:", config.host);
        conn = await mariadb.createConnection(config);
        console.log('Connected to database!');

        const rows = await conn.query('SELECT 1 as test');
        console.log('Query executed successfully:', rows);

        // Try to query your movies table
        const movies = await conn.query('SELECT * FROM movies');
        console.log('Movies query successful, found:', movies.length, 'rows');
        console.log('Sample data:', movies);

        await conn.end();
    } catch (err) {
        console.error('\n Connection failed:', err.message);
        console.error('Error code:', err.code);
        console.error('Full error:', err);
    }
}

test();