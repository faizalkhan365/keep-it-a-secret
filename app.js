//jshint esversion:6
require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));


app.use(session({
    secret: "My little secret",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

const url = "mongodb+srv://admin-faizal:1D7vj3jrIt6cg6NA@secretsdb.1wnffbz.mongodb.net/userDB" /* path of my db */;
mongoose.connect(url, { useUnifiedTopology: true, useNewUrlParser: true, }).then(() => {
    console.log("Connection successful...");
}).catch((e) => console.log("No connection!!!"));

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleID: {
        type: String,
        unique: true
    },
    secret: [
        {
            type: String
        }
    ]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});
passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://keep-it-a-secret.herokuapp.com/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleID: profile.id, username: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        res.redirect("/secrets");
    });

// ___________________________________________
app.get("/login", function (req, res) {
    res.render("login");
});

// ___________________________________________
app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {
    let innerHTML = "Loading";
    let href = "/secrets";

    // Fixed: Log Out button even if user is not logged in.
    if (req.isAuthenticated()) {
        innerHTML = "Log Out";
        href = "/logout";
    } else {
        innerHTML = "Log In";
        href = "/login";
    };

    User.find({ secret: { $ne: null } }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                res.render("secrets", { usersWithSecrets: foundUsers, logOutBtnText: innerHTML, logOutBtnLink: href });
            }
        }
    });
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated) {
        res.render("submit");
    } else {
        res.render("/login");
    }
});




app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    passport.authenticate("local", (err, user) => {
    if (err) {
        return next(err);
    }
    if (!user) {
        res.redirect("/login");
    }
    else {
        req.login(newUser, (err) => {
            if (err) {
                return next(err);
            } else {
                res.redirect("/secrets");
            }
        });
    }
});
});




app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;

    //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
    // console.log("User's id: " + req.user.id);

    User.findById(req.user._id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.secret.push(submittedSecret);
                console.log("added");
                foundUser.save(function () {
                    res.redirect("/secrets");
                });
            }
        }
    });

});

app.get("/logout", function (req, res, next) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect("/");
    });
});



app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    })
});
// ____________________________________________
let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}
app.listen(port, function () {
    console.log("Server has started on port: " + port);
});
