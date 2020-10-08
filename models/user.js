var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var userSchema = new mongoose.Schema({
	username: String,
	password: String,
	avatar: { type: String, default: "https://www.w3schools.com/bootstrap4/img_avatar3.png" },
	firstName: String,
	lastName: String,
	email: String,
	reading: [Object],
	read: [Object],
	toread: [Object],
    notifications: [
    	{
    	   type: mongoose.Schema.Types.ObjectId,
    	   ref: 'Notification'
    	}
    ],	
	reviews: [
		{
         type: mongoose.Schema.Types.ObjectId,
         ref: "Review"
      }
	],
	followers: [
    	{
    		type: mongoose.Schema.Types.ObjectId,
    		ref: 'User'
    	}
    ]
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
