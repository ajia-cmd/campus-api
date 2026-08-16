const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// 创建SQLite数据库保存账号
const db = new sqlite3.Database('./users.db', (err) => {
  if(err){
    console.error("数据库打开失败",err);
  }else{
    console.log("数据库连接成功");
    // 用户表 username唯一，password保存密码
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);
  }
});

// 注册接口 POST /api/user/create
// body {username:"xxx",password:"xxx"}
app.post('/api/user/create', (req,res)=>{
  const {username,password} = req.body;
  if(!username || !password){
    return res.status(400).json({msg:"账号和密码不能为空"});
  }
  // 插入用户，username唯一，重复会报错
  const sql = `INSERT INTO users(username,password) VALUES (?,?)`;
  db.run(sql,[username,password],function(err){
    if(err){
      if(err.message.includes("UNIQUE constraint failed")){
        return res.status(400).json({msg:"该账号已经被注册，请换一个账号"});
      }
      return res.status(500).json({msg:"注册数据库错误"});
    }
    return res.status(200).json({msg:"注册成功",userId:this.lastID});
  })
})

// 登录校验接口 POST /api/user/find
// 去数据库查找账号密码，必须注册过才可以登录，随便输入直接报错
app.post('/api/user/find', (req,res)=>{
  const {username,password} = req.body;
  if(!username||!password){
    return res.status(400).json({msg:"账号密码不能为空"});
  }
  const sql = `SELECT * FROM users WHERE username = ? AND password = ?`;
  db.get(sql,[username,password],(err,row)=>{
    if(err){
      return res.status(500).json({msg:"数据库查询错误"});
    }
    if(!row){
      // 数据库没有这条记录：账号未注册 /密码错误
      return res.status(401).json({msg:"账号不存在或者密码错误，请先注册账号"});
    }
    // 查询到存在，登录成功
    return res.status(200).json({msg:"登录成功",username:row.username});
  })
})

app.listen(PORT,()=>{
  console.log(`服务启动，端口:${PORT}`);
})
