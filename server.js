const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const User = require('./models/user')
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
            return res.status(401).json({status: 'error',message: 'invalid session'})
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