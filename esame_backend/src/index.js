import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { pool } from './db.js'
import { routerTopologie } from './routes/topologie.js'

const app = express()
const porta = Number(process.env.PORT ?? 3000)

app.use(cors())
app.use(express.json())

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1')

        res.json({ stato: "ok", database: "connesso" })
    } catch (errore) {
        res.status(503).json({ stato: "ko", database: "non raggiungibile", dettaglio: errore.message })
    }
})

app.use('/api/topologie', routerTopologie)

app.use((req, res) => {
    res.status(404).json({ errore: "Rotta non trovata: " + req.method + " " + req.originalUrl })
})

app.use((errore, req, res, next) => {
    console.error(errore)

    res.status(500).json({ errore: "Errore del server.", dettaglio: errore.message })
})

app.listen(porta, () => {
    console.log("API della topologia su http://localhost:" + porta)
})
