const express = require("express");
const database = require("better-sqlite3");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;
const db = new database(path.join(__dirname, "database.sqlite"))

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Liefert index.html, style.css etc. direkt aus

// Sql tabelle erstellen

db.exec(`
    CREATE TABLE IF NOT EXISTS places (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Beispieldaten einfügen, falls leer
const count = db.prepare('SELECT COUNT(*) as count FROM places').get().count;
if (count === 0) {
    const insert = db.prepare(`
        INSERT INTO places (slug, title, category, description, latitude, longitude, image_url)
        VALUES (@slug, @title, @category, @description, @latitude, @longitude, @image_url)
    `);
    insert.run({
        slug: 'schlossbergturm',
        title: 'Schlossbergturm',
        category: 'kultur',
        description: 'Historische Burganlage mit schönem Blick über die Stadt.',
        latitude: 48.215,
        longitude: 9.025,
        image_url: 'img/schlossbergturm.jpg'
    });
    insert.run({
        slug: 'irish-pub-ebingen',
        title: 'Irish Pub Ebingen',
        category: 'gastro',
        description: 'Gemütlicher Pub in Ebingen mit Getränken und Snacks.',
        latitude: 48.212,
        longitude: 9.029,
        image_url: 'img/IrishPub.png'
    });
    console.log('Initiale Beispieldaten in SQLite eingefügt.');
}
//erlaubte Kategorien, fehler handling
const ALLOWED_CATEGORIES = ['natur', 'kultur', 'aussicht', 'gastro', 'favoriten'];

// -------------------------------------------------------------
// REST-API: GET /api/places (Alle Orte abrufen)
// -------------------------------------------------------------

app.get("/api/places", (req, res) => {
    try{
        const {category,q} = req.query;
        let query = "SELECT * from places where 1=1";
        const params = [];

        if (category && ALLOWED_CATEGORIES.includes(category)){
            query += " AND category = ?";
            console.log("Hier zeigt es den Category")
            console.log(category)
            params.push(category);
        }

        if (q && typeof q === "string" && q.trim().length > 0){
            console.log("Hier zeigt es den q an")
            console.log(q)
            query += " AND (title LIKE ? OR description LIKE ?)";
            params.push(`%${q.trim()}%`, `%${q.trim()}%`);
        }

        query += ' ORDER BY id DESC';

        const stmt = db.prepare(query);
        const places = stmt.all(...params);

        res.json(places);
    }catch (error){
        console.error('Fehler bei GET /api/places:', error);
        res.status(500).json({ error: 'Interner Serverfehler beim Laden der Daten.' });
    }
});

// -------------------------------------------------------------
// REST-API: POST /api/places (Neuen Ort speichern)
// -------------------------------------------------------------

app.post("/api/places", (req, res) =>{
    try {
        const { title, category, description, latitude, longitude, image_url } = req.body;
        const errors = [];

        if(!title || typeof title !== "string" || title.trim().length < 2){
            errors.push("Titel muss mindestens 2 Zeichen lang sein.")
        }

        if(!category || !ALLOWED_CATEGORIES.includes(category)){
            errors.push("Ungültige Kategory ausgewählt!")
        }

        if(!description || typeof description !== "string" || description.trim().length < 5){
            errors.push("Beschreibung muss mindestens 5 Zeichen lang sein.")
        }
                
        const latNum = parseFloat(latitude);
        const lngNum = parseFloat(longitude);

        if(isNaN(latNum) || latNum < -90 || latNum > 90) {
            errors.push("Breitengrad (Latitude) muss eine gültige Zahl zwischen -90 und 90 sein.")
        }

        if(isNaN(lngNum) || lngNum < -180 || lngNum > 180){
            errors.push("Längengrad (Longitude) muss eine gültige Zahl zwischen -180 und 180 sein.")
        }

        // Falls Validierung fehlschlägt: 400 Bad Request zurückgeben
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors: errors
            });
        }

        const stmt = db.prepare(`
            INSERT INTO places (slug, title, category, description, latitude, longitude, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        // Generiere einen lesbaren Slug / ID-Key
        const cleanTitle = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const slug = `${cleanTitle}-${Date.now().toString().slice(-4)}`;
        const finalImage = (image_url && typeof image_url === 'string' && image_url.trim()) 
            ? image_url.trim() 
            : 'img/EbingenBspKarte.png';

        const info = stmt.run(
            slug,
            title.trim(),
            category,
            description.trim(),
            latNum,
            lngNum,
            finalImage
        )

        res.status(201).json({
        success: true,
        message: 'Ort erfolgreich gespeichert!',
            
        place: {
            id: info.lastInsertRowid,
            slug,
            title: title.trim(),
            category,
            description: description.trim(),
            latitude: latNum,
            image_url: finalImage,
            longitude: lngNum,
            }
        });
    } catch (error) {
        console.error('Fehler bei POST /api/places:', error);
        res.status(500).json({ success: false, error: 'Datenbankfehler beim Speichern.' });
    }
});

// Server starten
app.listen(3000, () => {
    console.log('Server läuft auf http://localhost:3000');
});