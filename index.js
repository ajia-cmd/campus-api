const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const SUPABASE_URL = "https://yqtdesbfhbtvwttqhhhrp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdGRlc2JmaGJ0ZHZ3dHRxaGhycCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg2ODE1MzIyLCJleHAiOjIxMDIzOTE1MzJ9.jMW5GSQmP_sm3ZCIWgB49OFSE_rek3MPO2qf8pT_czg";

const supabaseHeaders = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

app.post("/api/user/find", async (req, res) => {
    try {
        const { account } = req.body;
        const resp = await axios.get(
            `${SUPABASE_URL}/rest/v1/users?account=eq.${encodeURIComponent(account)}`,
            { headers: supabaseHeaders }
        );
        res.json({ ok: true, data: resp.data });
    } catch (e) {
        res.json({ ok: false, msg: e.message });
    }
});

app.post("/api/user/create", async (req, res) => {
    try {
        const { account, password, email } = req.body;
        const resp = await axios.post(
            `${SUPABASE_URL}/rest/v1/users`,
            [{ account, password, email }],
            { headers: supabaseHeaders }
        );
        res.json({ ok: true, data: resp.data });
    } catch (e) {
        res.json({ ok: false, msg: e.message });
    }
});

// ✅手机部署重点！不能写死3000端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
    console.log(`服务启动，端口:${PORT}`);
});
