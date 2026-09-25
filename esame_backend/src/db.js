import mysql from 'mysql2/promise'

// Un solo pool per tutta l'applicazione: le connessioni si riusano invece di
// aprirne una nuova ad ogni richiesta. Dentro docker compose DB_HOST e' "db",
// lanciando l'API dal computer e' 127.0.0.1 con la porta 3307 del container.
export const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.MYSQL_USER ?? "esame",
    password: process.env.MYSQL_PASSWORD ?? "esame",
    database: process.env.MYSQL_DATABASE ?? "topologie",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10
})
