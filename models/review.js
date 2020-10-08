var mongoose = require("mongoose");

//REVIEW MODEL
var reviewSchema = new mongoose.Schema({
	author: {
		id:{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Users"
		},
		username: String
	},
	rating: Number,
	body: String,
	book_id: String,
	bookData: Object,
	created: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Review", reviewSchema);
