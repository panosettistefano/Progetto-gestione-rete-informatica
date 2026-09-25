import { Router } from 'express'
import { pool } from '../db.js'

export const routerTopologie = Router()

const TIPI = ["PC", "Switch", "Router"]
const STATI = ["Online", "Offline", "Manutenzione"]

// Elenco: solo l'intestazione di ogni topologia salvata.
routerTopologie.get('/', async (req, res) => {
    const [topologie] = await pool.query('SELECT id, nome, creata_il FROM topologie ORDER BY id')

    res.json(topologie)
})

routerTopologie.get('/:id', controllaId, async (req, res) => {
    const topologia = await leggiTopologia(req.params.id)

    if (!topologia) {
        res.status(404).json({ errore: "Topologia " + req.params.id + " non trovata." })
        return
    }

    res.json(topologia)
})

routerTopologie.post('/', async (req, res) => {
    const problema = validaCorpo(req.body)

    if (problema) {
        res.status(400).json({ errore: problema })
        return
    }

    const id = await inTransazione(async (connessione) => {
        const [esito] = await connessione.execute('INSERT INTO topologie (nome) VALUES (?)', [req.body.nome])

        await inserisciContenuti(connessione, esito.insertId, req.body)

        return esito.insertId
    })

    res.status(201).json(await leggiTopologia(id))
})

// Sostituisce il contenuto della topologia: i dispositivi vengono riscritti da
// zero, quindi cambiano id e i collegamenti vanno rimappati.
routerTopologie.put('/:id', controllaId, async (req, res) => {
    const problema = validaCorpo(req.body)

    if (problema) {
        res.status(400).json({ errore: problema })
        return
    }

    const esistente = await leggiTopologia(req.params.id)

    if (!esistente) {
        res.status(404).json({ errore: "Topologia " + req.params.id + " non trovata." })
        return
    }

    await inTransazione(async (connessione) => {
        await connessione.execute('UPDATE topologie SET nome = ? WHERE id = ?', [req.body.nome, req.params.id])
        await connessione.execute('DELETE FROM connessioni WHERE topologia_id = ?', [req.params.id])
        await connessione.execute('DELETE FROM dispositivi WHERE topologia_id = ?', [req.params.id])

        await inserisciContenuti(connessione, req.params.id, req.body)
    })

    res.json(await leggiTopologia(req.params.id))
})

// Le tabelle hanno ON DELETE CASCADE, quindi basta togliere la topologia.
routerTopologie.delete('/:id', controllaId, async (req, res) => {
    const [esito] = await pool.execute('DELETE FROM topologie WHERE id = ?', [req.params.id])

    if (esito.affectedRows == 0) {
        res.status(404).json({ errore: "Topologia " + req.params.id + " non trovata." })
        return
    }

    res.json({ eliminata: Number(req.params.id) })
})

async function leggiTopologia(varId) {
    const [topologie] = await pool.query('SELECT id, nome, creata_il FROM topologie WHERE id = ?', [varId])

    if (topologie.length == 0) {
        return null
    }

    const [dispositivi] = await pool.query(
        'SELECT id, tipo, nome, x, y, ip, hostname, stato FROM dispositivi WHERE topologia_id = ? ORDER BY id',
        [varId]
    )

    const [connessioni] = await pool.query(
        'SELECT id, sorgente_id, destinazione_id FROM connessioni WHERE topologia_id = ? ORDER BY id',
        [varId]
    )

    return {
        id: topologie[0].id,
        nome: topologie[0].nome,
        creata_il: topologie[0].creata_il,
        dispositivi: dispositivi,
        connessioni: connessioni.map(connessione => ({
            id: connessione.id,
            sourceId: connessione.sorgente_id,
            targetId: connessione.destinazione_id
        }))
    }
}

// Gli id dei dispositivi arrivano dal browser: il database ne assegna di nuovi,
// quindi la mappa vecchio → nuovo serve per riscrivere i collegamenti.
async function inserisciContenuti(varConnessione, varIdTopologia, varCorpo) {
    const mappa = new Map()

    for (const dispositivo of varCorpo.dispositivi) {
        const [esito] = await varConnessione.execute(
            'INSERT INTO dispositivi (topologia_id, tipo, nome, x, y, ip, hostname, stato) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [varIdTopologia, dispositivo.tipo, dispositivo.nome, dispositivo.x, dispositivo.y,
                dispositivo.ip, dispositivo.hostname, dispositivo.stato]
        )

        mappa.set(dispositivo.id, esito.insertId)
    }

    for (const connessione of varCorpo.connessioni) {
        await varConnessione.execute(
            'INSERT INTO connessioni (topologia_id, sorgente_id, destinazione_id) VALUES (?, ?, ?)',
            [varIdTopologia, mappa.get(connessione.sourceId), mappa.get(connessione.targetId)]
        )
    }
}

async function inTransazione(varLavoro) {
    const connessione = await pool.getConnection()

    try {
        await connessione.beginTransaction()

        const esito = await varLavoro(connessione)

        await connessione.commit()

        return esito
    } catch (errore) {
        await connessione.rollback()
        throw errore
    } finally {
        connessione.release()
    }
}

function controllaId(req, res, next) {
    if (!/^\d+$/.test(req.params.id)) {
        res.status(400).json({ errore: "Id non valido: " + req.params.id })
        return
    }

    next()
}

function validaCorpo(varCorpo) {
    if (!varCorpo || typeof varCorpo.nome != "string" || varCorpo.nome.trim() == "") {
        return "Serve il nome della topologia."
    }

    if (!Array.isArray(varCorpo.dispositivi) || !Array.isArray(varCorpo.connessioni)) {
        return "dispositivi e connessioni devono essere due elenchi."
    }

    const id = []

    for (const dispositivo of varCorpo.dispositivi) {
        if (!Number.isInteger(dispositivo.id) || id.includes(dispositivo.id)) {
            return "Ogni dispositivo deve avere un id numerico, diverso da quello degli altri."
        }

        if (!TIPI.includes(dispositivo.tipo)) {
            return "Tipo di dispositivo non ammesso: " + dispositivo.tipo
        }

        if (!STATI.includes(dispositivo.stato)) {
            return "Stato non ammesso: " + dispositivo.stato
        }

        if (typeof dispositivo.nome != "string" || typeof dispositivo.ip != "string"
            || typeof dispositivo.hostname != "string") {
            return "Nome, IP e hostname devono essere testo."
        }

        if (!Number.isInteger(dispositivo.x) || !Number.isInteger(dispositivo.y)) {
            return "Le coordinate di " + dispositivo.nome + " devono essere numeri interi."
        }

        id.push(dispositivo.id)
    }

    for (const connessione of varCorpo.connessioni) {
        if (connessione.sourceId == connessione.targetId) {
            return "Un dispositivo non può essere collegato a sé stesso."
        }

        if (!id.includes(connessione.sourceId) || !id.includes(connessione.targetId)) {
            return "Collegamento verso un dispositivo che non c'è: "
                + connessione.sourceId + " → " + connessione.targetId
        }
    }

    return null
}
