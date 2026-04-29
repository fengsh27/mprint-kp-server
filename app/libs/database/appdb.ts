import mysql from 'mysql2/promise';

// Separate pool for kb_app: cache tables, user feedback, and any other
// app-generated data. Same MySQL server/credentials as silverdb but targets
// the APP_DB_NAME database where the app user has read/write access.
const appPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    database: process.env.APP_DB_NAME ?? 'kb_app',
});

export default appPool;
