const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const User = require('./models/user')
const Category = require('./models/category')
const jwb = require('jsonwebtoken')
require('dotenv').config()

const JWBSECRET = process.env.SECRET

mongoose.connect('mongodb://localhost:27017/sweeftApp',{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true
})

app.use(express.json())
app.use(express.urlencoded({extended: false}))


app.post('/register',async (req,res) => {
    const {username,password} = req.body
    if(!username || typeof username !== 'string') {
        return res.status(401).json({status: 'error',message: 'invalid username'})
    }
    if(!password || typeof password !== 'string') {
        return res.status(401).json({status: 'error',message: 'invalid password'})
    }

    if(password.length < 6 || password.length > 10) {
        return res.status(401).json({ status : 'error',message: 'password should be at least 6 and max 10 characters long'})
    }
    
    const hashedPassword = await bcrypt.hash(password,10)
    try {
        const user = await User.create({
            username,
            password: hashedPassword
        })
        const jwbToken = jwb.sign({id: user._id,username: user.username},JWBSECRET)
        return res.status(201).json({status: 'ok',data: user,token: jwbToken})
    } catch(error) {
        if(error.code === 11000) {
            return res.status(401).json({status: 'error',message: 'username already used'})
        }
        return res.status(500).json({status: 'error',message: error})
    }
})
app.post('/login',async (req,res) => {
    const {username,password} = req.body 
    const user = await User.findOne({username})
    
    if (!user) {
        return res.status(401).json({status: 'error',message: 'invalid username/password'})
    }

    if (await bcrypt.compare(password,user.password)) {
        const jwbToken = jwb.sign({id: user._id,username: user.username},JWBSECRET)
        return res.status(200).json({status: 'ok',token:jwbToken})
    }
    return res.status(401).json({status: 'error',message: 'invalid username/password'})

})

app.put('/change-password',async (req,res) => {
    
    const {token,password,oldPassword} = req.body 
    if (!password || !oldPassword) {
        return res.status(400).json({status: 'error',message: "some of the fields is not filled"})
    }
    if (password.length === 0 || password.length > 10) {
        return res.status(400).json({status: 'error',message: "password can't be empty or more than 10 characters long"})
    }
    let user
    try {
        user = jwb.verify(token,JWBSECRET)
    } catch(error) {
        return res.status(403).json({status: 'error',message: 'invalid session, invalid json web token format'})
    }
    try {
        if(!user.hasOwnProperty('id')) {
            return res.status(403).json({status: 'error',message: 'invalid session'})
        }
        const id = user.id 
        const databaseUser = await User.findById(id)
        const isOldPasswordCorrect = await bcrypt.compare(oldPassword,databaseUser.password)
        if(!isOldPasswordCorrect) {
            return res.status(400).json({status: "error",message: "invalid old password"})
        }
        if (await bcrypt.compare(password,databaseUser.password)) {
            return res.status(400).json({status: 'error',message: 'password is same with new old one'})
        }
        const hashedPassword = await bcrypt.hash(password,10)
        await User.updateOne({_id: id},{
            $set: {password: hashedPassword}
        })
        return res.status(204).send()
    } catch(error) {
        return res.status(500).json({status: 'error',message: 'internal server error, can not update password'})
    }
})

app.post('/new-category',async (req,res) => {
    if (req.headers['content-type'] !== 'application/json') {
        return res.status(415).json({status: 'error',message: 'unsupported media type'})
    }
    const {name,token} = req.body
    let user
    try {
        user = jwb.verify(token,JWBSECRET)
    } catch(error) {
        return res.status(400).json({status: 'error',message: 'invalid token format'})
    }
    try {
        if (!name) {
            return res.status(400).json({status: 'error',message: "category name required"})
        }
        const category = await Category.findOne({name,userId: user.id})
        if(category) {
            return res.status(400).json({status: 'error',message: `category with name ${name} is already created`})
        }
        await Category.create({name,userId: user.id})
        return res.status(200).json({status: 'ok',message: 'category created'})

    } catch(error) {
        console.log(error)
        return res.status(500).json({status: 'error',message: 'internal server error'})
    }
}) 

app.put('/update-category',async (req,res) => {
    const {name,token,newName} = req.body
    let user
    try {
        user = jwb.verify(token,JWBSECRET)
    } catch(error) {
        return res.status(400).json({status: 'error',message: 'invalid token format'})
    }
    if (!name) {
        return res.status(400).json({status: 'error',message: 'category old name required'})
    }
    if (!newName) {
        return res.status(400).json({status: 'error',message: 'category new name required'})
    }
    if(name === newName) {
        return res.status(400).json({status: 'error',message: 'new name should be different from old one'})
    }
    try {
        const exists = await Category.exists({name,userId: user.id})
        if (!exists) {
            return res.status(400).json({status: 'error',message: 'invalid category name'})
        }
        const {_id} = await Category.findOne({name,userId: user.id})
        await Category.findByIdAndUpdate(_id,{
            $set: {name: newName}}
        )
        return res.status(200).json({status: 'ok',message: 'category name updated'})
    } catch(error) {
        return res.status(500).json({status: 'error',message: 'internal server error'})
    }
})

app.delete('/delete-category',async (req,res) => {
    const {name,token} = req.body
    let user
    try {
        user = jwb.verify(token,JWBSECRET)
    } catch(error) {
        return res.status(400).json({status: 'error',message: 'invalid token format'})
    }
    if (!name) {
        return res.status(400).json({status: 'error',message: 'category name required'})
    }
    try {
        const exists = await Category.exists({name,userId: user.id})
        if (!exists) {
            return res.status(400).json({status: 'error',message: 'invalid category name'})
        }
        const {incomes,outcome,userId,_id} = await Category.findOne({name,userId: user.id})
        await Category.updateOne({name: "default"},{
            name: 'default',incomes,outcome,userId
        })
        await Category.findByIdAndDelete(_id)
        return res.status(200).json({status: 'ok',message: `category with name ${name} deleted succesfully`})
    } catch(error) {
        return res.status(500).json({status: 'error',message: 'internal server error'})
    }
})

app.put('/update-category-transactions',async (req,res) => {
    const {data,token} = req.body
    let user
    try {
        user = jwb.verify(token,JWBSECRET)
    } catch(error) {
        return res.status(400).json({status: 'error',message: 'invalid token format'})
    }
    if (data.length === 0) {
        return res.status(400).json({status: 'error',message: 'update data not found'})
    }
    try {
        data.forEach(async (item) => {
            const {name,incomes,outcomes} = item
            if (!name) {
                const exists = await Category.findOne({name: "default",userId: user.id})
                if(!exists) {
                    await Category.create({name:"default",userId: user.id})
                }
                await Category.updateOne({name: "default",userId: user.id},{
                    $push: { incomes: {$each: incomes}}, $push: {outcomes: {$each: outcomes}}
                },{ runValidators: true })
            } else {
                const category = await Category.findOneAndUpdate({name,userId: user.id},{
                    $push: { incomes: {$each: incomes},outcomes: {$each: outcomes}}
                },{ runValidators: true })
            }
        })
        return res.status(200).json({status: 'ok',message: 'category transactions updated'})
    } catch(error) {
        return res.status(500).json({status: 'error',message: 'internal server error'})
    }
})

app.get('/outcomes/user/:id/category/:name',async (req,res) => {
    const {id,name} = req.params
    const {filter,startDate,endDate,minAmount,maxAmount} = req.query
    try {
        const category = await Category.findOne({name,userId: id})
        if(!category) {
            return res.status(400).json({status: "error",message: "invalid search query"})
        }
        if(filter) {
            if (filter === "time") {   
                const categories = await Category.find({
                    date: {$gte: startDate,$lte: endDate}
                }) 
                return res.status(200).json({status: "ok",data: categories})
            }
            if(filter === "money") {
                const categories = await Category.find({
                    'outcomes.amount': { $gte: minAmount,$lte: maxAmount}
                })
                console.log(categories)
                return res.status(200).json({status: "ok",data: categories})
            }
        } else {
            return res.status(200).json({status: "ok",data: category.outcomes})
        }
    } catch(error) {
        return res.status(500).json({status: 'error',message: 'internal server error'})
    }
})

app.get('/register',(req,res) => {
    res.send('register page')
}) 

app.get('/login',(req,res) => {
    res.send('login page')
}) 

app.get('/',(req,res) => {
    res.send('main page')
}) 

app.listen(3000)