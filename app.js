if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');



// mongoose.connect(currentUrl, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// });

// const db = mongoose.connection;
// db.on("error", console.error.bind(console, "connection error:"));
// db.once("open", () => {
//     console.log("Database connected");
// });


const app = express();
app.use(cors());


app.get('/', (req, res) => {
    res.send('Welcome to the home page');
})

app.get('/test', async (req, res, next) => {
    console.log('huston we have contact');
    res.send(JSON.stringify({ messages: 'heyo' }));
});


let PORT = process.env.PORT;
if (PORT == null || PORT == "") {
    PORT = 3000;
}

app.listen(PORT, () => {
    console.log(`Serving on port ${PORT}`)
})