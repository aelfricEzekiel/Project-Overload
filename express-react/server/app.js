const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const conn = require('./mysql/conn');
const jwt = require('jsonwebtoken');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');

require('dotenv').config();

app.set('port', process.env.PORT || 5000);
app.set('host', process.env.HOST || 'localhost');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_KEY || crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
    }
}))

app.get('/api', (req, res) => {
    res.status(200).json({
        login: "Login Account",
        title: "Register Account",
    })
})

app.get('/home', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized. Please log in." })
    }
    return res.status(200).json({
        message: "Welcome to the Home Page",
        session: req.session.user
    })
})

app.get('/data', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized. Please log in." })
    }

    const data = `SELECT id, firstName, lastName, email, dateOfbirth FROM tbl_accounts`;

    conn.query(data, (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Failed to retrieve data' })
        } else {
            return res.json({ message: result })
        }
    })
})

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(64).toString('hex');

    if (!SECRET_KEY) {
        return res.json({
            error: "Failed to generate token"
        })
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

app.post('/register', (req, res) => {
    const { firstName, lastName, dateOfBirth, email, password } = req.body;

    const generateToken = process.env.SECRET_KEY || crypto.randomBytes(64).toString('hex');

    if (!generateToken) {
        return res.json({ error: "Failed to generate token" })
    }

    const insertquery = `INSERT INTO tbl_accounts (firstName, lastName, email, dateOfbirth, password) VALUES (?, ?, ?, ?, ?)`;

    if (!firstName && !lastName && !email && !dateOfBirth && !password) {
        return res.status(200).json({ message: "All fields are required" })
    }

    if (!firstName) {
        return res.status(200).json({ message: "First Name is required" })
    }

    if (!lastName) {
        return res.status(200).json({ message: "Last Name is required" })
    }

    if (!email) {
        return res.status(200).json({ message: "Email is required" })
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/;
    if (!emailRegex.test(email)) {
        return res.status(200).json({ message: "Invalid email address" })
    }
    
    if(!dateOfBirth){
        return res.status(200).json({ message: "Date of Birth is required" })
    }

    if(!validateDate(dateOfBirth)){
        return res.status(200).json({ message: "Invalid date of birth" })
    }

    if (!password) {
        return res.status(200).json({ message: "Password is required" })
    }

    if (password.length <= 4) {
        return res.status(200).json({ message: "Your password is weak" })
    }

    if (password.length <= 8) {
        return res.status(200).json({ message: "Your password is moderate" })
    }

    if (password.length <= 12 && password.length >= 8) {
        return res.status(200).json({ message: "Your password is strong" })
    }

    conn.query(insertquery, [firstName, lastName, email, dateOfBirth, password], (err, result) => {
        if (err) {
            return res.status(200).json({ message: "Failed to register user" })
        };

        const token = jwt.sign({ id: result.insertId }, generateToken, { expiresIn: '1h' });
        const session = req.session.user = {
            id: result.insertId,
        }
        return res.status(200).json({
            message: "Registered Successfully", 
            token: token, 
            session: session 
        })
    })
})

app.listen(app.get('port'), app.get('host'), () => {
    console.log(`Server is running on http://${app.get('host')}:${app.get('port')}/api`);
})