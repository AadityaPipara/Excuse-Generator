require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(express.json());
app.use(cors());

const ai = new Groq({ apiKey: process.env.GROQ_API_KEY });

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`);
    db.run(`CREATE TABLE IF NOT EXISTS excuses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, excuse TEXT, absurdity TEXT)`);
});

app.post('/api/excuse', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    db.run(`INSERT OR IGNORE INTO users (name) VALUES (?)`, [name], function(err) {
        db.get(`SELECT id FROM users WHERE name = ?`, [name], async (err, user) => {
            if (!user) return res.status(500).json({ error: 'Database error' });
            
            const userId = user.id;

            db.all(`SELECT excuse FROM excuses WHERE user_id = ?`, [userId], async (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: "Failed to load history from database" });
                }
                const history = rows.map(r => r.excuse);
                const count = history.length;

                let absurdity = "mundane and highly believable";
                if (count >= 2 && count <= 3) absurdity = "mildly unusual and strange";
                if (count >= 4) absurdity = "completely ridiculous, absurd, and unbelievable (like a flock of pigeons hijacking an auto-rickshaw)";

                try {
                   const prompt = `Generate a unique, single-sentence excuse for being late or missing a deadline. 
                   The tone should be ${absurdity}. 
                   CRITICAL: Do not repeat any of these previous excuses: [${history.join(', ')}]. 
                   Return ONLY the excuse string, nothing else.`;

                    const chatCompletion = await ai.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: "llama-3.1-8b-instant", 
                    });

                    const newExcuse = chatCompletion.choices[0]?.message?.content.trim();

                    db.run(`INSERT INTO excuses (user_id, excuse, absurdity) VALUES (?, ?, ?)`, [userId, newExcuse, absurdity], () => {
                        res.json({
                            excuse: newExcuse,
                            history: [...history, newExcuse]
                        });
                    });

                } catch (aiError) {
                    console.error("GROQ API ERROR:", aiError);
                    const fallbackExcuse = `Unforeseen technical delay #${count + 1} occurred, holding up production progress.`;
                    db.run(`INSERT INTO excuses (user_id, excuse, absurdity) VALUES (?, ?, ?)`, [userId, fallbackExcuse, absurdity], () => {
                        res.json({ excuse: fallbackExcuse, history: [...history, fallbackExcuse] });
                    });
                }
            });
        });
    });
});

app.get('/', (req, res) => {
    res.status(200).send("Excuse Generator Backend is awake!");
});
app.listen(5000, () => console.log('Server running on port 5000'));