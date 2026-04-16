const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const conn = require('./mysql/conn');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');

const BCRYPT_SALT_ROUNDS = 10;

app.set('port', process.env.PORT || 5000);
app.set('host', process.env.HOST || 'localhost');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function generateId(length) {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*()_+';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

app.use(session({
    secret: process.env.SESSION_KEY || generateId(70),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
    }
}))

app.get('/api', (req, res) => {
    res.status(200).json({
        login: "Login Account",
        title: "Register Account",
    })
})

app.get('/home', (req, res) => {
    return res.status(200).json({
        message: "Welcome to the Home Page",
        session: req.session.user
    })
})

app.get('/data', (req, res) => {
    const data = `SELECT * FROM tbl_accounts`;

    conn.query(data, (err, result) => {
        if (err) {
            return res.json({ message: `Cannot retrieve data:  ${err}` })
        } else {
            return res.json({ message: result })
        }
    })
})

app.post('/login', (req, res) => {
    function generateId(length) {
        let result = '';
        let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*()_+';
        let charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    const { email, password } = req.body;
    const SECRET_KEY = process.env.SECRET_KEY || generateId(70);

    if (!SECRET_KEY) {
        return res.json({
            error: "Failed to generate token"
        })
    } else {
        console.log(`Token: ${SECRET_KEY}`);
    }

    const loggedInQuery = `SELECT * FROM tbl_accounts WHERE email = ? AND password = ?`;

    if (!email && !password) {
        return res.status(200).json({
            error: "Fill up all required fields"
        })
    }

    if (!email) {
        return res.status(200).json({ error: "Email is required!" })
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/;
    if (!emailRegex.test(email)) {
        return res.status(200).json({ error: "Invalid email adddress" })
    }

    if (!password) {
        return res.json({ error: "Password is required!" })
    }

    if (password.length <= 8) {
        return res.status(200).json({ error: "Incorrect password" })
    }

    conn.query(loggedInQuery, [email, password], (err, result) => {
        if (err) {
            return res.status(200).json({ error: "Failed to login" })
        } else {
            if (!result.find((user) => user.email === email && user.password === password)) {
                return res.status(200).json({ error: "Invalid email and password" })
            }

            const user = result[0];
            const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1h' });
            const session = req.session.user = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
            }

            return res.status(200).json({
                message: "Logged in successfully",
                token: token,
                session: session
            })
        }
    })
})

const validateDate = (date) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(date)) {
        return false
    }

    const parts = date.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (month < 1 || month > 12) {
        return false
    }

    if (day < 1 || day > 31) {
        return false
    }

    const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if(month === 2){
        const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

        if(isLeapYear){
            monthLengths[1] = 29;
        }
    }

    return day <= monthLengths[month - 1];
}

app.post('/register', async (req, res) => {
    try {
        const rawFirstName = req.body.firstName;
        const rawLastName = req.body.lastName;
        const rawEmail = req.body.email;
        const dateOfBirth = req.body.dateOfBirth;
        const password = req.body.password;

        // Check if all fields are missing
        if (!rawFirstName && !rawLastName && !rawEmail && !dateOfBirth && !password) {
            return res.status(400).json({ error: "All fields are required" })
        }

        // Validate individual required fields
        if (!rawFirstName) {
            return res.status(400).json({ error: "First Name is required" })
        }

        if (!rawLastName) {
            return res.status(400).json({ error: "Last Name is required" })
        }

        if (!rawEmail) {
            return res.status(400).json({ error: "Email is required" })
        }

        // Trim string inputs
        const firstName = rawFirstName.trim();
        const lastName = rawLastName.trim();
        const email = rawEmail.trim().toLowerCase();

        if (!firstName) {
            return res.status(400).json({ error: "First Name cannot be empty" })
        }

        if (!lastName) {
            return res.status(400).json({ error: "Last Name cannot be empty" })
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email address" })
        }

        if (!dateOfBirth) {
            return res.status(400).json({ error: "Date of Birth is required" })
        }

        if (!validateDate(dateOfBirth)) {
            return res.status(400).json({ error: "Invalid date of birth" })
        }

        if (!password) {
            return res.status(400).json({ error: "Password is required" })
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters long" })
        }

        // Check for duplicate email before inserting
        const checkEmailQuery = `SELECT id FROM tbl_accounts WHERE email = ?`;
        conn.query(checkEmailQuery, [email], async (err, existingUsers) => {
            if (err) {
                return res.status(500).json({ error: "An internal server error occurred" })
            }

            if (existingUsers.length > 0) {
                return res.status(409).json({ error: "An account with this email already exists" })
            }

            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

            const insertQuery = `INSERT INTO tbl_accounts (firstName, lastName, email, dateOfbirth, password) VALUES (?, ?, ?, ?, ?)`;
            conn.query(insertQuery, [firstName, lastName, email, dateOfBirth, hashedPassword], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: "Failed to register user" })
                }

                const SECRET_KEY = process.env.SECRET_KEY || generateId(70);
                const token = jwt.sign({ id: result.insertId }, SECRET_KEY, { expiresIn: '1h' });
                req.session.user = {
                    id: result.insertId,
                }

                return res.status(201).json({
                    message: "Registered successfully",
                    token: token,
                    session: req.session.user
                })
            })
        })
    } catch (err) {
        return res.status(500).json({ error: "An unexpected error occurred" })
    }
})

app.listen(app.get('port'), app.get('host'), () => {
    console.log(`Server is running on http://${app.get('host')}:${app.get('port')}/api`);
})