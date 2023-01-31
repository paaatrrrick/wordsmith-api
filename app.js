if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const multer = require('multer');
const path = require('path');
const users = require('./models/users.js');
const {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
} = require('firebase/auth');
const { initializeApp } = require('firebase/app');
const jwt = require('jsonwebtoken');
const { randomStringToHash24Bits } = require('./utils/miscUtils');
const { isLoggedIn } = require('./utils/middleware');

const errorMessage = require('./utils/errorMessage');
const catchAsync = require('./utils/catchAsync');

const firebaseConfig = {
    apiKey: process.env.FIREBASE_KEY,
    authDomain: "wordsmith-auth.firebaseapp.com",
    projectId: "wordsmith-auth",
    storageBucket: "wordsmith-auth.appspot.com",
    messagingSenderId: "315192723360",
    appId: "1:315192723360:web:733126e071a610640546c5",
    measurementId: "G-WHP68FVH93"
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);

const DB_URL = process.env.DB_URL;
const DB_DEFAULT = 'mongodb://0.0.0.0:27017/wordsmith';
const currentUrl = DB_URL;
const isTesting = false;

mongoose.set('strictQuery', true);
mongoose.connect(currentUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});


const app = express();
app.use(bodyParser.json(), bodyParser.urlencoded({ extended: false }))
app.use(cors());
app.use(cookieParser());


const { Configuration, OpenAIApi } = require("openai");

//apiKey: process.env.openAI,
const configuration = new Configuration({
    apiKey: process.env.openAI,
});
const openai = new OpenAIApi(configuration);

//set max age of cookie to -1 for logout

app.get('/yo', (req, res) => {
    res.send('yoyo');
});

app.get('/auth/isLoggedIn', isLoggedIn, catchAsync(async (req, res, next) => {
    res.status(200).send({ message: 'successful login' });
}));




app.post('/auth/signup-email', catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    createUserWithEmailAndPassword(firebaseAuth, email, password)
        .then((fireBaseUser) => {
            const uid = randomStringToHash24Bits(fireBaseUser.user.uid);
            const newUser = new users({ _id: uid, email: email })
            newUser.save().then(() => {
                const token = jwt.sign({ _id: uid, }, process.env.JWT_PRIVATE_KEY, { expiresIn: "1000d" });
                res.status(200).send({ token: token, message: 'Login successful' });
            }).catch((error) => {
                //TODO: delete the user from firebase
                res.status(500).send({ message: error.message });
            })
        })
        .catch(error => {
            console.log(error);
            const errorMessage = error.message;
            res.status(500).send({ message: error.message });
        });
}));



app.post('/auth/login-email', catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    signInWithEmailAndPassword(firebaseAuth, email, password)
        .then((fireBaseUser) => {
            const uid = randomStringToHash24Bits(fireBaseUser.user.uid);
            const token = jwt.sign({ _id: uid, }, process.env.JWT_PRIVATE_KEY, { expiresIn: "1000d" });
            res.status(200).send({ token: token, message: 'Login successful' });
        })
        .catch(error => {
            res.status(401).send({ message: 'Incorrect email or password' });
        });
}));

app.post('/auth/google', catchAsync(async (req, res, next) => {
    const { idToken, email } = req.body;
    const uid = randomStringToHash24Bits(idToken);
    const user = await users.findById(uid);
    if (!user) {
        const newUser = new users({ _id: uid, email: email })
        await newUser.save();
    }
    const token = jwt.sign({ _id: uid, }, process.env.JWT_PRIVATE_KEY, { expiresIn: "1000d" });
    res.status(200).send({ token: token, message: 'Login successful' });
    // } catch (error) {
    //     console.log('e')
    //     res.status(500).send({ message: 'Error creating user' });
    // };
    // const user = await users.findById(idToken);
    // if (user) {
    //     const token = jwt.sign({ _id: idToken, }, process.env.JWT_PRIVATE_KEY, { expiresIn: "1000d" });
    //     res.status(200).send({ token: token
}));


app.post('/chrome/workmagic', isLoggedIn, catchAsync(async (req, res, next) => {
    if (!isTesting) {
        const text = req.body.text;
        const pills = req.body.pills;
        let prompt = "Rewrite the following text exactly the same but it";
        if (pills.length === 1) {
            prompt += ` ${pills[0].aiTextPrompt}:`;
        } else {
            console.log('second');
            for (let i = 0; i < pills.length; i++) {
                const pill = pills[i];
                const aiTextPrompt = pill.aiTextPrompt;
                if (i === pills.length - 1) {
                    prompt += ` and${aiTextPrompt}:`;
                } else {
                    prompt += `${aiTextPrompt},`;
                }
            }
        }
        prompt += ` ${text}`;
        console.log('about to send request');
        console.log(prompt);
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: prompt,
            temperature: 0,
            max_tokens: 300,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        var responseText = response.data.choices[0].text;
        console.log(responseText);
        responseText = responseText.replace(/(\r\n|\n|\r)/gm, "");
        const userId = res.userId;
        const updateLog = { userEntry: text, aiEntry: responseText };
        //appends the updatelog to recentChanges in the user. If the length of recentChanges is greater than 10, it removes the oldest entry
        await users.findByIdAndUpdate
            (userId, { $push: { recentChanges: updateLog } }, { new: true, upsert: true, setDefaultsOnInsert: true })
            .then((user) => {
                if (user.recentChanges.length > 12) {
                    user.recentChanges.shift();
                    user.save();
                } else {
                    user.save();
                }
            })
            .catch((error) => {
                console.log(error);
            });
        res.status(200).send({ message: responseText });
    } else {
        var responseText = 'It is unlikely that the client will be satisfied with our proposal.';
        res.status(200).send({ message: responseText });
    }
}));

app.get('/recentchanges', isLoggedIn, catchAsync(async (req, res, next) => {
    const userId = res.userId;
    const user = await users.findById(userId);
    res.status(200).send({ recentChanges: user.recentChanges });
}));


app.use((err, req, res, next) => {
    console.log('error bottom handler');
    console.error(err);
    res.status(500).send('Something went wrong');
});

let PORT = process.env.PORT;
if (PORT == null || PORT == "") {
    PORT = 3000;
}

app.listen(PORT, () => {
    console.log(`Serving on port ${PORT}`)
});

