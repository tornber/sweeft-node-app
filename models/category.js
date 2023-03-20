const mongoose = require('mongoose')

const CategorySchema = new mongoose.Schema({
    name: {type: String,required: true},
    incomes: Array,
    outcome: Number,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
})

const model = mongoose.model('Category',CategorySchema)

module.exports = model