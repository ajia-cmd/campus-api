const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 打开SQLite数据库
const db = new sqlite3.Database('./users.db', (err) => {
    if(err){
        console.error("数据库打开失败",err.message);
    }else{
        console.log("数据库连接成功");
        // 表增加email字段，UNIQUE约束：同一个邮箱不允许重复注册
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL
        )`);
    }
});

// ==========注册接口：username,password,email ==========
app.post('/api/user/create', (req,res)=>{
    const {username,password,email} = req.body;
    if(!username || !password || !email){
        return res.status(400).json({msg:"账号、密码、邮箱不能为空"});
    }
    const sql = `INSERT INTO users(username,password,email) VALUES (?,?,?)`;
    db.run(sql,[username,password,email],function(err){
        if(err){
            console.error(err);
            // 捕获唯一约束冲突：用户名重复 / 邮箱重复
            if(err.message.includes("UNIQUE constraint failed: users.username")){
                return res.status(400).json({msg:"该账号已经被注册"});
            }
            if(err.message.includes("UNIQUE constraint failed: users.email")){
                return res.status(400).json({msg:"该邮箱已经注册过账号，一个邮箱仅可注册一个账号"});
            }
            return res.status(500).json({msg:"注册数据库异常"});
        }
        res.json({ok:true,msg:"注册成功"});
    })
});

// ==========登录校验接口==========
app.post('/api/user/find',(req,res)=>{
    const {username,password}=req.body;
    db.get(`SELECT * FROM users WHERE username=? AND password=?`,[username,password],(err,row)=>{
        if(err) return res.status(500).json({msg:"数据库错误"});
        if(!row) return res.status(400).json({msg:"账号或者密码错误"});
        res.json({ok:true,username:row.username});
    })
});

// =========获取全部用户列表（管理员后台用，返回账号、密码、邮箱）========
app.get('/api/user/list',(req,res)=>{
    db.all(`SELECT username,password,email FROM users`,[],(err,rows)=>{
        if(err){
            return res.status(500).json({msg:"读取失败"});
        }
        res.json({list:rows});
    })
});

// =========删除用户接口========
app.post('/api/user/delete',(req,res)=>{
    const {username}=req.body;
    db.run(`DELETE FROM users WHERE username=?`,[username],function(err){
        if(err) return res.status(500).json({msg:"删除失败"});
        if(this.changes===0) return res.status(400).json({msg:"该用户不存在"});
        res.json({ok:true,msg:"删除成功"});
    })
});

app.listen(port,()=>{
    console.log(`服务启动，端口：${port}`);
})
