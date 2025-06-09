const express = require("express");
const router = express.Router();


router.get("/", (req, res) => {
    res.render("Home", { title: "Home Page" });
});

// router.get("/users/:id", (req, res) => {
//     const id = req.params.id
//     res.render("index", { title: id });
// });

module.exports = router;