const mongoose = require('mongoose')

const CategorySchema = new mongoose.Schema({
    name: {type: String,required: true},
    income: Number,
    outcome: Number,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
})

const model = mongoose.model('Category',CategorySchema)

module.exports = model