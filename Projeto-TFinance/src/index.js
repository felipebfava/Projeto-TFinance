const path = require('path')
const express = require("express");
const cors = require("cors");
const sqlite = require("sqlite3");
const router = require("../routes/routes.js");

const db = new sqlite.Database("./database/sqlite.db");
db.once("open", () => console.log("Conectado ao sqlite"));

const hostname = 'localhost'
const port = 3000

const app = express()

app.use(express.urlencoded({ extended: false}));
app.use(express.json())
app.use(cors())
app.set('view engine', 'ejs');

app.use('/css', express.static(path.join('./node_modules/bootstrap/dist/css')))
app.use('/js', express.static(path.join('.', 'node_modules/bootstrap/dist/js')))
app.use('/js', express.static(path.join('.', 'node_modules/jquery/dist')))

app.use(router);

app.listen(port, () => {
    console.log(`Servidor rodando em: http://${hostname}:${port}`)
})