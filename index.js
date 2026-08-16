const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const cron = require('node-cron');
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
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            is_banned INTEGER NOT NULL DEFAULT 0,
            ban_expire_time DATETIME NULL
        )`);
        db.run(`ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0`,()=>{});
        db.run(`ALTER TABLE users ADD COLUMN ban_expire_time DATETIME NULL`,()=>{});
    }
});

function getBanExpireTime(banMinute){
    if(banMinute === 0) return null;
    const now = new Date();
    return new Date(now.getTime() + banMinute * 60 * 1000).toISOString();
}

function checkBanStatus(row){
    if(!row.is_banned){
        return {banned:false};
    }
    if(!row.ban_expire_time){
        return {
            banned:true,
            isForever:true,
            msg:"账号已被永久封禁，无法登录"
        }
    }
    const now = new Date();
    const expire = new Date(row.ban_expire_time);
    if(now >= expire){
        return {banned:false, autoUnban:true}
    }
    const remainSecond = Math.ceil((expire.getTime() - now.getTime()) / 1000);
    const h = Math.floor(remainSecond / 3600);
    const m = Math.floor((remainSecond % 3600)/60);
    const s = remainSecond % 60;
    const formatStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return {
        banned:true,
        isForever:false,
        remainSecond,
        msg:`账号已被封禁，还有 ${formatStr} 自动解除封禁`
    }
}

function startBanCron(){
    cron.schedule('*/5 * * * *', ()=>{
        const nowIso = new Date().toISOString();
        db.run(`UPDATE users SET is_banned=0, ban_expire_time=NULL WHERE is_banned=1 AND ban_expire_time IS NOT NULL AND ban_expire_time < ?`,[nowIso],function(err){
            if(err){
                console.error("[封禁定时任务错误]",err);
            }else if(this.changes>0){
                console.log(`[定时任务]自动解封 ${this.changes} 个过期封禁账号`);
            }
        })
    })
    console.log("过期封禁定时任务已启动，每5分钟扫描一次");
}
startBanCron();

//注册接口
app.post('/api/user/create', (req,res)=>{
    const {username,password,email} = req.body;
    if(!username || !password || !email){
        return res.status(400).json({msg:"账号、密码、邮箱不能为空"});
    }
    const sql = `INSERT INTO users(username,password,email) VALUES (?,?,?)`;
    db.run(sql,[username,password,email],function(err){
        if(err){
            console.error(err);
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

//登录校验接口（带封禁检测）
app.post('/api/user/find',(req,res)=>{
    const {username,password}=req.body;
    db.get(`SELECT * FROM users WHERE username=? AND password=?`,[username,password],(err,row)=>{
        if(err) return res.status(500).json({msg:"数据库错误"});
        if(!row) return res.status(400).json({msg:"账号或者密码错误"});

        const banInfo = checkBanStatus(row);
        if(banInfo.autoUnban){
            db.run(`UPDATE users SET is_banned=0, ban_expire_time=NULL WHERE id=?`,[row.id]);
        }
        if(banInfo.banned){
            return res.status(403).json({
                code:403,
                msg:banInfo.msg,
                data:{
                    isForever:banInfo.isForever,
                    remainSecond: banInfo.remainSecond ?? null
                }
            })
        }
        res.json({ok:true,username:row.username});
    })
});

//获取全部用户列表
app.get('/api/user/list',(req,res)=>{
    db.all(`SELECT username,password,email,is_banned,ban_expire_time FROM users`,[],(err,rows)=>{
        if(err){
            return res.status(500).json({msg:"读取失败"});
        }
        res.json({list:rows});
    })
});

//删除用户接口
app.post('/api/user/delete',(req,res)=>{
    const {username}=req.body;
    db.run(`DELETE FROM users WHERE username=?`,[username],function(err){
        if(err) return res.status(500).json({msg:"删除失败"});
        if(this.changes===0) return res.status(400).json({msg:"该用户不存在"});
        res.json({ok:true,msg:"删除成功"});
    })
});

//封禁用户接口
app.post('/api/admin/ban-user', (req,res)=>{
    const {email, banMinute} = req.body;
    const expireStr = getBanExpireTime(banMinute);
    db.run(`UPDATE users SET is_banned=1, ban_expire_time=? WHERE email=?`,[expireStr,email],function(err){
        if(err) return res.status(500).json({msg:"封禁失败"});
        if(this.changes === 0) return res.status(404).json({msg:"该邮箱账号不存在"});
        return res.json({ok:true,msg:"封禁成功"});
    })
})

//解封接口
app.post('/api/admin/unban-user', (req,res)=>{
    const {email} = req.body;
    db.run(`UPDATE users SET is_banned=0, ban_expire_time=NULL WHERE email=?`,[email],function(err){
        if(err) return res.status(500).json({msg:"解封失败"});
        if(this.changes ===0) return res.status(404).json({msg:"账号不存在"});
        return res.json({ok:true,msg:"已解除封禁"});
    })
})

app.listen(port,()=>{
    console.log(`服务启动，端口：${port}`);
})
