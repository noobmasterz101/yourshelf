var express 				    = require("express");
var app 					      = express();
var mongoose 				    = require("mongoose");
var bodyParser 				  = require("body-parser");
var methodOverride 			= require("method-override");
var passport 				    = require("passport");
var LocalStratergy 			= require("passport-local");
var passportLocalMongoose 	= require("passport-local-mongoose");
var User					      = require("./models/user");
var Review					    = require("./models/review");
var Notification			  = require("./models/notification");
const axios 				    = require('axios');


//APP CONFIG 
mongoose.set('useNewUrlParser', true);
mongoose.set('useUnifiedTopology', true);
mongoose.connect("mongodb://localhost/books_app");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.use(require("express-session")({
	secret: "everything is connected",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStratergy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async function(req, res, next){
	res.locals.currentUser = req.user;
    if(req.user) {
    	try {
      		let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
      		res.locals.notifications = user.notifications.reverse();
   	 	}catch(err) {
      		console.log(err.message);
    	}
    }	
	//res.locals.error = req.flash("error");
	//res.locals.success = req.flash("success");
	next();
});



//ROUTES
app.get("/", function(req, res){
	res.render("landing");
});

app.get("/books/:id", function(req, res){
	var id = req.params.id;
	axios.get("https://www.googleapis.com/books/v1/volumes/" + id)
		.then(function(response){
			var bookData = response.data;
			Review.find({book_id: id}, function(err, foundReviews){
				if(err){
					console.log(err);
				}
				else{
					res.render("books/show", {bookData: bookData, reviews: foundReviews});
				}
			});
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});
});

app.get("/books/:id/review/new", isLoggedIn, function(req, res){
	var id = req.params.id;
	axios.get("https://www.googleapis.com/books/v1/volumes/" + id)
		.then(function(response){
			var bookData = response.data;
			//console.log(bookData)
			res.render("reviews/new", {bookData: bookData});
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});
});

app.post("/books/:id", isLoggedIn, function(req, res){
	axios.get("https://www.googleapis.com/books/v1/volumes/" + req.params.id)
		.then(function(response){
			var bookData = response.data;
			var review = req.body.review;
			review.bookData = bookData;
			review.book_id = req.params.id;
			review.author = {
				id: req.user._id,
				username: req.user.username
			}
			//console.log(review);
			//res.send("REVIEW WILL BE ADDED!");
			Review.create(review, async function(err, newReview){
				if(err){
					console.log("REVIEW CREATION FAILED!!!");
				}
				else{
					  let user = await User.findById(req.user._id).populate('followers').exec();
					  let newNotification = {
						username: req.user.username,
						reviewId: newReview._id,
						book_id: req.params.id
					  }
					  for(const follower of user.followers) {
						let notification = await Notification.create(newNotification);
						follower.notifications.push(notification);
						follower.save();
					  }					
					console.log("newReview");
					res.redirect("/books/"+req.params.id);	
				}
			});		
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});	
});

app.get("/books/:id/review/:review_id", function(req, res){
	var book_id = req.params.id;
	var review_id = req.params.review_id;
	axios.get("https://www.googleapis.com/books/v1/volumes/" + book_id)
		.then(function(response){
			var bookData = response.data;
			Review.findById(review_id, function(err, foundReview){
				if(err){
					console.log(err);
				}
				else{
					res.render("reviews/show", {bookData: bookData, review: foundReview});
				}
			});
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});
});

//ROUTE to edit Review
app.get("/books/:id/review/:review_id/edit", checkReviewOwnership, function(req, res){
	var book_id = req.params.id;
	var review_id = req.params.review_id;
	axios.get("https://www.googleapis.com/books/v1/volumes/" + book_id)
		.then(function(response){
			var bookData = response.data;
			Review.findById(review_id, function(err, foundReview){
				if(err){
					console.log(err);
				}
				else{
					res.render("reviews/edit", {bookData: bookData, review: foundReview});
				}
			});
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});	
});

//ROUTE TO UPDATE REVIEW
app.put("/books/:id/review/:review_id", checkReviewOwnership, function(req, res){
	var newReview = req.body.review;
	newReview.book_id = req.params.id;
	Review.findByIdAndUpdate(req.params.review_id, newReview, function(err, updatedReview){
		if(err){
			console.log(err)
		}
		else{
			res.redirect("/books/"+req.params.id+"/review/"+req.params.review_id);
		}
	});
});

//ROUTE TO DELETE A REVIEW
app.delete("/books/:id/review/:review_id", checkReviewOwnership, isLoggedIn, function(req, res){
	Review.findByIdAndRemove(req.params.review_id, function(err){
		if(err){
			console.log(err);
		}
		else{
			res.redirect("/books/" + req.params.id);
		}
	})
});

app.get("/results", function(req, res){
	var name = req.query.name.toLowerCase();
	//console.log(req.query.name);
	axios.get('https://www.googleapis.com/books/v1/volumes?q='+name)
	  .then(function (response) {
		// handle success
		var resultList = response.data.items;
		res.render("results", {searchName:name, resultList: resultList});
		//console.log(resultList);
	  })
	  .catch(function (error) {
		// handle error
		console.log(error);
	  })
	  .finally(function () {
		// always executed
	  });
});

//ROUTE FOR NEW USER CREATION
app.get("/register", function(req, res){
	res.render("users/new");
});

app.post("/register", function(req, res){
	var newUser = new User({
		username: req.body.username, 
		avatar: req.body.image,
		firstName: req.body.firstName,
		lastName: req.body.lastName,
		email: req.body.email
	});
	//console.log(newUser);
	User.register(newUser, req.body.password, function(err, user){
		if(err){
			console.log(err);
			return res.render("users/new");
		}
		else{
			//user.image = req.body.image;
			passport.authenticate("local")(req, res, function(){
				res.redirect("/");
			});
		}
	});
});

//ROUTE TO LOGIN
app.get("/login", function(req, res){
	res.render("login");
});

app.post("/login", passport.authenticate("local", {
	successRedirect: "/",
	failureRedirect: "/login"
}) , function(req, res){
});

//LOGOUT
app.get("/logout", function(req, res){
	req.logout();
	res.redirect("/");
});

//USER PROFILE
app.get("/users/:id", function(req, res){
	User.findById(req.params.id).populate("followers").exec(function(err, foundUser){
		if(err){
			console.log(err);
		}
		else{
			//console.log(foundUser);
			Review.find().where('author.id').equals(foundUser._id).exec(function(err, userReviews){
				if(err){
					console.log(err);
				}
				else{
					res.render("users/profile", {userData: foundUser, userReviews: userReviews});
				}
			});
		}
	});
});

//ROUTE TO FOLLOW A USER
app.get("/follow/:id", isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    //req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch(err) {
    //req.flash('error', err.message);
	  console.log(err);
    res.redirect('back');
  }
});

// view all notifications
app.get("/notifications", isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } }
    }).exec();
    let allNotifications = user.notifications;
    res.render("notifications/index", { allNotifications });
  } catch(err) {
    //req.flash('error', err.message);
    res.redirect('back');
  }
});

// handle notification
app.get("/notifications/:id", isLoggedIn, async function(req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(`/books/${notification.book_id}/review/${notification.reviewId}`);
  } catch(err) {
    //req.flash('error', err.message);
    res.redirect('back');
  }
});

//ROUTE FOR ADDING BOOK TO "WANT TO READ" SHELF
app.post("/users/:id/toread/:book_id", isLoggedIn, function(req, res){
	axios.get("https://www.googleapis.com/books/v1/volumes/" + req.params.book_id)
		.then(function(response){
			var bookData = response.data;
			User.findByIdAndUpdate(
				req.params.id,
				{ $push: { "toread" : bookData } },
				function(err, updatedUser){
					if(err){
						console.log(err);
					}
					else{
						//console.log(updatedUser.toread[0]);
						res.redirect("/users/"+req.params.id + "/myshelves");
					}
			});
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});	
});

//ROUTE TO REMOVE BOOK FROM "TO READ" LIST
app.delete("/users/:id/toread/:book_id", function(req, res){
			User.findByIdAndUpdate(
				req.params.id,
				{ $pull: { 'toread': { id: req.params.book_id } } },
				function(err, updatedUser){
					if(err){
						console.log(err);
					}
					else{
						//console.log(updatedUser.toread[0]);
						res.redirect("/users/"+req.params.id + "/myshelves");
					}
			});
});

//ROUTE TO REMOVE BOOK FROM "CURRENTLY READING" LIST
app.delete("/users/:id/reading/:book_id", function(req, res){
			User.findByIdAndUpdate(
				req.params.id,
				{ $pull: { 'reading': { id: req.params.book_id } } },
				function(err, updatedUser){
					if(err){
						console.log(err);
					}
					else{
						//console.log(updatedUser.toread[0]);
						res.redirect("/users/"+req.params.id + "/myshelves");
					}
			});
});

//ROUTE TO REMOVE BOOK FROM "READ" LIST
app.delete("/users/:id/read/:book_id", function(req, res){
			User.findByIdAndUpdate(
				req.params.id,
				{ $pull: { 'read': { id: req.params.book_id } } },
				function(err, updatedUser){
					if(err){
						console.log(err);
					}
					else{
						//console.log(updatedUser.toread[0]);
						res.redirect("/users/"+req.params.id + "/myshelves");
					}
			});
});

//ROUTE FOR ADDING BOOK TO "CURRENTLY READING" SHELF
app.post("/users/:id/reading/:book_id", isLoggedIn, function(req, res){
	axios.get("https://www.googleapis.com/books/v1/volumes/" + req.params.book_id)
		.then(function(response){
			var bookData = response.data;
			User.findByIdAndUpdate(
				req.params.id,
				{ 
					$push: { "reading" : bookData }
				},
				function(err, updatedUser){
					if(err){
						console.log(err);
					}
					else{						
						res.redirect("/users/"+req.params.id + "/myshelves");
					}
			});
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});	
});

//ROUTE FOR ADDING BOOK TO "READ" SHELF
app.post("/users/:id/read/:book_id", isLoggedIn, function(req, res){
	axios.get("https://www.googleapis.com/books/v1/volumes/" + req.params.book_id)
		.then(function(response){
			var bookData = response.data;
			User.findByIdAndUpdate(
				req.params.id,
				{ 
					$push: { "read" : bookData }
				},
				function(err, updatedUser){
					if(err){
						console.log(err);
					}
					else{						
						res.redirect("/users/"+req.params.id + "/myshelves");
					}
			});
		})
		.catch(function (error) {
			// handle error
			console.log(error);
	  	})
	   .finally(function () {
			// always executed
	  	});	
});

//ROUTE TO VIEW MY SHELVES
app.get("/users/:id/myshelves", function(req, res){
	User.findById(req.params.id, function(err, foundUser){
		if(err){
			console.log(err)
		}
		else{
			res.render("users/books", {userData: foundUser});
		}
	});
});



//==================================================================================
//middleware

function isLoggedIn(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	res.redirect("/login");
};

function checkReviewOwnership(req, res, next){
	if(req.isAuthenticated()){
		Review.findById(req.params.review_id, function(err, foundReview){
			if(foundReview.author.id.equals(req.user._id)){
				next();
			}
			else{
				res.redirect("back");
			}
		});
	}
	else{
		res.redirect("back");
	}
}

//==================================================================================
app.listen(3000, function(){
	console.log("YourShelf App has Started !!!");
});
