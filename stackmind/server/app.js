const app = require('./express/express');
const conn = require('./mysql/conn');

app.get('/', (req, res) => {
    res.send({ message: "hello backend from nodejs" })
})

app.post('/insert', (req, res) => {
    const id = 0;
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
        return res.status(400).send({ error: "Email and password are required" });
    }

    const insertQuery = `INSERT INTO students VALUES (?, ?, ?)`;

    conn.query(insertQuery, [id, email, password], (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            return res.status(500).send({ error: "Failed to insert student" });
        }
        res.send({
            response: "1 student inserted"
        });
    })

})
app.listen(app.get('port'), app.get('host'), () => {
    console.log(`Server is running at http://${app.get('host')}:${app.get('port')}`);
})