var express = require("express"),
    app = express(),
    mongoose = require("mongoose"),
    bodyparser = require("body-parser"),
    flash = require("connect-flash"),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    passportLocalMongoose = require("passport-local-mongoose"),
    methodOverride = require("method-override");
    
mongoose.connect("mongodb://xiaoluo:one123@ds135534.mlab.com:35534/picture-sharing");

app.use(bodyparser.urlencoded({extended : true}));
app.use(express.static("public"));
app.use(methodOverride("_method"));
app.use(flash());
app.set("view engine", "ejs");

var UserSchema = new mongoose.Schema({
    username: String,
    password: String
});

UserSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User", UserSchema);
//  Define user

var commentSchema = new mongoose.Schema({
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
    text: String
});

var Comment = mongoose.model("Comment", commentSchema);
//  Define comment

var imageSchema = new mongoose.Schema({
    name: String,
    image: String,
    description: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
        }
    ]
});

var Image = mongoose.model("Image", imageSchema);
//  Define image

app.use(require("express-session")({
    secret: "Once again Rusty wins cutest dog!",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

app.get("/", function(req, res){
    res.render("landing");
})

app.get("/images", function(req, res){
    Image.find({}, function(err, allimages){
        if (err) {
            console.log("error 1");
        } else {
            res.render("images", {images: allimages});
        }
    });
});

app.post("/images", isLoggedIn, function(req, res){
    var name = req.body.name;
    var image = req.body.image;
    var desc = req.body.description;
    var author = {
        id: req.user._id,
        username: req.user.username
    }
    var newImage = {name: name, image: image, description: desc, author:author}
    Image.create(newImage, function(err, newlyCreated){
        if(err){
            console.log(err);
        } else {
            res.redirect("/images");
        }
    });
});
//  view image

app.get("/images/new", isLoggedIn, function(req, res){
    res.render("new");
})

app.get("/images/:id", function(req, res){
    var id = req.params.id;
    Image.findById(id).populate("comments").exec(function(err, image){
        if (err) {
            console.log("error 2");
        } else {
            res.render("show",{image: image});
        }
    });
})
//create image with user info

app.get("/images/:id/edit", checkImageOwnership, function(req, res){
    Image.findById(req.params.id, function(err, foundImage){
        if (err) {
            console.log("error 4");
        } else {
            res.render("imageedit", {image: foundImage});
        }
    });
});

app.put("/images/:id", checkImageOwnership, function(req, res){
    var image = {
        name: req.body.name,
        image: req.body.image,
        description: req.body.description ,
    }
    Image.findByIdAndUpdate(req.params.id, image, function(err, updatedImage){
        if(err){
            res.redirect("/images");
        } else {
            res.redirect("/images/" + req.params.id);
        }
    });
});
//  update image with user info

app.delete("/images/:id", checkImageOwnership, function(req, res){
    Image.findByIdAndRemove(req.params.id, function(err){
        if (err) {
            res.redirect("/images");
        } else {
            res.redirect("/images");
        }
    });
});
//  delete image with user info

app.get("/images/:id/comments/new", isLoggedIn, function(req, res){
    var id = req.params.id;
    Image.findById(id, function(err, image){
        if (err) {
            console.log("error 5");
        } else {
            res.render("newcomment", {image: image});
        }
    });
})
//  view comment

app.post("/images/:id/comments", isLoggedIn, function(req, res){
    var id = req.params.id;
    var text = req.body.text;
    Image.findById(id, function(err, image){
        if (err) {
            console.log("error 6");
            res.redirect("/images");
        } else {
            Comment.create({
                text: text,
                author: {
                    id: req.user._id,
                    username: req.user.username
                }
            }, function(err, comment){
                if (err) {
                    req.flash("error", "Something went wrong");
                    console.log("error 7");
                } else {
                    image.comments.push(comment);
                    image.save();
                    req.flash("success", "Successfully added comment");
                    res.redirect("/images/"+image._id);
                }
            });
        }
    });
    console.log("post finish");
})
//  create comment with user info

app.get("/images/:id/comments/:comment_id/edit", checkCommentOwnership, function(req, res){
    Comment.findById(req.params.comment_id, function(err, foundComment){
        if (err) {
            req.flash("error", "Image not found");
            res.redirect("back");
        } else {
            res.render("commentedit", {image_id: req.params.id, comment: foundComment});
        }
    });
});

app.put("/images/:id/comments/:comment_id", checkCommentOwnership, function(req, res){
    // var comment = {
    //     text: req.body.text,
    // }
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
        if (err) {
            res.redirect("back");
        } else {
            res.redirect("/images/" + req.params.id );
        }
    });
});
//  update comment with user info

app.delete("/images/:id/comments/:comment_id", checkCommentOwnership, function(req, res){
    Comment.findByIdAndRemove(req.params.comment_id, function(err){
        if (err) {
            res.redirect("back");
        } else {
            req.flash("success", "Comment deleted");
            res.redirect("/images/" + req.params.id);
        }
    });
});
//  delete comment with user info

app.get("/register", function(req, res){
    res.render("register"); 
});

app.post("/register", function(req, res){
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            console.log("error6");
            return res.render("register", {"error": err.message});
        }
        passport.authenticate("local")(req, res, function(){
            req.flash("success", "Welcome to YelpCamp, " + user.username + "!");
            res.redirect("/images"); 
        });
    });
});

app.get("/login", function(req, res){
    res.render("login"); 
});

app.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/images",
        failureRedirect: "/login"
    }), function(req, res){
});

app.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "You have logged out");
    res.redirect("/images");
});
//  Authentication

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You need to be logged in to do that");
    res.redirect("/login");
}

function checkImageOwnership(req, res, next) {
    if(req.isAuthenticated()){
        Image.findById(req.params.id, function(err, foundImage){
            if(err){
                req.flash("error", "Image not found");
                res.redirect("back");
            } else {
                if(foundImage.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
}

function checkCommentOwnership(req, res, next) {
    if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id, function(err, foundComment){
            if(err){
               res.redirect("back");
            } else {
                // does user own the comment?
                if(foundComment.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
}


app.listen(process.env.PORT, process.env.IP, function(){
    console.log("server start");
})
