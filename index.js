const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const SUPABASE_URL = "https://yqtdesbfhbtvwttqhhhrp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.XMDIzOTE1MzU5JMW5G5G50mP_sm3ZClWgB49OFSE_rek3MPO2qf8pT_czg";

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log("服务启动，端口:"+PORT);
});
