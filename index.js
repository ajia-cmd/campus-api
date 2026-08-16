const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

//中间件
app.use(cors());
app.use(express.json());

//打开sqlite数据库 users.db
const db = new sqlite3.Database('./users.db', (err) => {
    if(err){
        console.error("数据库连接失败",err.message);
    }else{
        console.log("数据库连接成功");
        //创建用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);
    }
});

//1.注册接口 /api/user/create
app.post('/api/user/create',(req,res)=>{
    const {username,password} = req.body;
    if(!username || !password){
        return res.status(400).json({msg:"账号密码不能为空"});
    }
    const sql = `INSERT INTO users(username,password) VALUES (?,?)`;
    db.run(sql,[username,password],function(err){
        if(err){
            if(err.message.includes("UNIQUE")){
                return res.status(400).json({msg:"该账号已经被注册"});
            }
            return res.status(500).json({msg:"注册失败："+err.message});
        }
        res.json({ok:true,msg:"注册成功",insertId:this.lastID});
    })
});

//2.登录校验接口 /api/user/find
app.post('/api/user/find',(req,res)=>{
    const {username,password} = req.body;
    if(!username || !password){
        return res.status(400).json({msg:"账号密码不能为空"});
    }
    const sql = `SELECT id,username FROM users WHERE username=? AND password=?`;
    db.get(sql,[username,password],(err,row)=>{
        if(err){
            return res.status(500).json({msg:"查询错误："+err.message});
        }
        if(!row){
            return res.status(401).json({msg:"账号或者密码错误"});
        }
        res.json({ok:true,user:row});
    })
});

//3.获取全部用户列表（包含密码，给admin后台调用）
app.get('/api/user/list',(req,res)=>{
    const sql = `SELECT id,username,password FROM users`;
    db.all(sql,[],(err,rows)=>{
        if(err){
            return res.status(500).json({ok:false,msg:err.message});
        }
        res.json({ok:true,list:rows});
    })
});


app.listen(PORT,()=>{
    console.log(`服务启动，端口:${PORT}`);
});
