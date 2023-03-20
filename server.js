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
            password
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
    
    if(!user) {
        return res.status(401).json({status: 'error',message: 'invalid username/password'})
    }

    if(bcrypt.compare(password,user.password)) {
        const jwbToken = jwb.sign({id: user._id,username: user.username},JWBSECRET)
        return res.status(200).json({status: 'ok',token:jwbToken})
    }
    return res.status(401).json({status: 'error',message: 'invalid username/password'})

})

app.put('/change-password',async (req,res) => {
    const {token,password} = req.body 
    try {
        const user = jwb.verify(token,JWBSECRET)
        if(user.hasOwnProperty('id')) {
            return res.status(403).json({status: 'error',message: 'invalid session'})
        }
        const id = user.id 
        const hashedPassword = await bcrypt.hash(password,10)
        await User.updateOne({id},{
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
    const user = jwb.verify(token,JWBSECRET)
    if (!name) {
        return res.status(422).json({status: 'error',message: 'category name required'})
    }
    try {
        await Category.create({name,userId: user.id})
        return res.status(200).json({status: 'ok',message: 'category created'})

    } catch(error) {
        return res.status(500).json({status: 'error',message: 'internal server error'})
    }
}) 

app.put('/update-category',async (req,res) => {
    const {name,token,newName} = req.body
    const user = jwb.verify(token,JWBSECRET)
    if (!name) {
        return res.status(422).json({status: 'error',message: 'category name required'})
    }
    try {
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
    const user = jwb.verify(token,JWBSECRET)
    if (!name) {
        return res.status(422).json({status: 'error',message: 'category name required'})
    }
    try {
        const {income,outcome,userId} = await Category.findOne({name,userId: user.id})
        await Category.createOrUpdate({name: "default"},{
            name: 'default',income,outcome,userId
        })
        await Category.findByIdAndDelete(category._id)
        return res.status(200).json({status: 'ok',message: 'category name updated'})
    } catch(error) {
        return res.status(500).json({status: 'error',message: 'internal server error'})
    }
})

app.put('/update-category-transactions',async (req,res) => {
    const data = req.body
    const user = jwb.verify(token,JWBSECRET)
    if (data.length === 0) {
        return res.status(422).json({status: 'error',message: 'update data not found'})
    }
    try {
        data.forEach(async (item) => {
            const {name,incomes,outcome} = item
            if (!name) {
                await Category.updateOne({name: "default",userId: user.id},{
                    $set: {incomes: {$push: {incomes: {$each: incomes}}},outcome}
                })
            } else {
                await Category.findOneAndUpdate({name,userId: user.id},{
                    $set: {incomes: {$push: {incomes: {$each: incomes}}},outcome}
                })
            }
        })
        return res.status(200).json({status: 'ok',message: 'category transactions updated'})
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