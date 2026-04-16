const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

require('dotenv').config();

const app = express();

app.set('port', process.env.APP_PORT || 4000);
app.set('host', process.env.APP_HOST || 'localhost');
app.set("view engine", "ejs");

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("../../public"));

module.exports = app;