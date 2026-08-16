const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// ===== QQ邮箱配置（填你自己的）=====
const mailer = nodemailer.createTransport({
  host: 'smtp.qq.com', port: 465, secure: true,
  auth: { user: process.env.QQ_MAIL_USER, pass: process.env.QQ_MAIL_PASS }
});

// ===== 数据库 =====
const db = new sqlite3.Database('./users.db', err=>{
  if(err) console.error(err); else console.log('SQLite OK');
});
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE, password TEXT, email TEXT UNIQUE,
  is_banned INTEGER DEFAULT 0, ban_expire_time DATETIME
)`);

// 定时解封
cron.schedule('*/5 * * * *', ()=>{
  db.run(`UPDATE users SET is_banned=0, ban_expire_time=NULL WHERE is_banned=1 AND ban_expire_time IS NOT NULL AND ban_expire_time < datetime('now')`);
});

// ===== 保活接口（Render 用）=====
app.get('/api/ping', (req,res)=>res.send('ok'));

// ===== 发验证码 =====
app.post('/api/mail/code', async (req,res)=>{
  const {email}=req.body;
  if(!/^[\w.-]+@qq\.com$/i.test(email)) return res.status(400).json({msg:'仅QQ邮箱'});
  const code = String(Math.floor(100000+Math.random()*900000));
  await mailer.sendMail({ from:process.env.QQ_MAIL_USER, to:email, subject:'验证码', text:`验证码：${code}，5分钟有效` });
  res.json({ok:1, code}); // 前端临时存code，正式可删code只存后端
});

// ===== 注册 =====
app.post('/api/user/create', (req,res)=>{
  const {username,password,email,code,realCode}=req.body;
  if(code!==realCode) return res.status(400).json({msg:'验证码错'});
  db.run(`INSERT INTO users(username,password,email) VALUES(?,?,?)`,[username,password,email],
    e=> e?res.status(400).json({msg:'账号/邮箱已存在'}):res.json({msg:'注册成功'}));
});

// ===== 登录（明文+封禁）=====
app.post('/api/user/find', (req,res)=>{
  const {username,password}=req.body;
  db.get(`SELECT * FROM users WHERE username=?`,[username],(e,r)=>{
    if(!r||r.password!==password) return res.status(400).json({msg:'账号或密码错'});
    if(r.is_banned&&(!r.ban_expire_time||new Date(r.ban_expire_time)>new Date()))
      return res.status(403).json({msg:'账号被封禁'});
    res.json({ok:1, username});
  });
});

// ===== 用户列表 =====
app.get('/api/user/list', (req,res)=>{
  db.all(`SELECT username,password,email,is_banned,ban_expire_time FROM users`,[],(e,r)=>res.json({list:r}));
});

// ===== 删除 =====
app.post('/api/user/delete', (req,res)=>{
  db.run(`DELETE FROM users WHERE username=?`,[req.body.username],()=>res.json({ok:1}));
});

// ===== 封禁 =====
app.post('/api/admin/ban-user', (req,res)=>{
  const {email,banMinute}=req.body;
  const t = banMinute>0?`datetime('now','+${banMinute} minutes')`:null;
  db.run(`UPDATE users SET is_banned=1, ban_expire_time=${t?'?':null}`, t?[t,email]:[email],()=>res.json({ok:1}));
});

// ===== 解封 =====
app.post('/api/admin/unban-user', (req,res)=>{
  db.run(`UPDATE users SET is_banned=0, ban_expire_time=NULL WHERE email=?`,[req.body.email],()=>res.json({ok:1}));
});

app.listen(port,()=>console.log('Server on',port));