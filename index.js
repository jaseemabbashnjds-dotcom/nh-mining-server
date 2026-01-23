const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

// 🔥 CRASH HANDLER: Global error catching taaki server band na ho
process.on('uncaughtException', (err) => {
  console.error('💥 Critical Error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});

const app = express();

// RAILWAY PORT: Railway dynamic port assign karta hai
const PORT = process.env.PORT || 8080;

app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log("⚡ Supabase Client Initialized Successfully");
    } catch (e) {
        console.error("🚨 Supabase Connection Failed:", e.message);
    }
} else {
    console.error("🚨 ERROR: Supabase Variables are missing!");
}

// 🇮🇳 INDIA TIME HELPER
const getTodayDateIST = () => {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istTime.toISOString().split('T')[0]; 
};

// ✅ HEALTH CHECK: Railway isi route ko check karke server zinda rakhta hai
app.get('/', (req, res) => {
    res.status(200).send('OK'); // Simple "OK" Railway healthcheck ke liye best hai
});

// ✅ REGISTER API
app.post('/api/register', async (req, res) => {
  if (!supabase) return res.status(500).json({ success: false, message: "DB Connection Error" });
  
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle(); 

    if (fetchError) throw fetchError;

    if (existingUser) {
      if ((existingUser.balance || 0) < 1000) {
          await supabase.from('users').update({ balance: 1000 }).eq('uid', uid);
      }
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // Referral Logic
    if (referralCode && referralCode.trim() !== "") {
      const { data: referrer } = await supabase.from('users').select('*').ilike('username', referralCode.trim()).maybeSingle();
      if (referrer) {
         await supabase.from('users').update({ referral_count: (referrer.referral_count || 0) + 1 }).eq('uid', referrer.uid);
      }
    }

    const todayDate = getTodayDateIST();
    let startingBalance = Math.max(1000, Number(importedBalance) || 0);

    const { error: insertError } = await supabase
      .from('users')
      .insert([{ 
        uid, email, username, phone: phone || null,
        balance: startingBalance,
        referral_count: importedReferralCount || 0,
        today_taps: 0,
        last_active_date: todayDate 
      }]);

    if (insertError) throw insertError;

    res.status(200).json({ success: true, message: username });
  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ success: false, message: "Registration Failed" });
  }
});

// ✅ STATS API
app.post('/api/mining-stats', async (req, res) => {
  if (!supabase) return res.status(500).json({ success: false });
  const { uid } = req.body;
  try {
    const { data: user } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (!user) return res.status(404).json({ success: false });

    const todayDate = getTodayDateIST();
    if (user.last_active_date !== todayDate) {
      await supabase.from('users').update({ today_taps: 0, last_active_date: todayDate }).eq('uid', uid);
      user.today_taps = 0;
    }

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps,
      maxTaps: 5000 + ((user.referral_count || 0) * 500),
      referralCount: user.referral_count,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ✅ SYNC & CLAIM
app.post('/api/sync-taps', async (req, res) => {
  if (!supabase) return res.status(500).json({ success: false });
  const { uid, taps } = req.body;
  try {
    await supabase.from('users').update({ today_taps: taps }).eq('uid', uid);
    res.status(200).json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/claim', async (req, res) => {
  if (!supabase) return res.status(500).json({ success: false });
  const { uid, amount } = req.body; 
  try {
    const { data: user } = await supabase.from('users').select('balance').eq('uid', uid).maybeSingle();
    if (user) {
        await supabase.from('users').update({ balance: (user.balance || 0) + (amount || 0) }).eq('uid', uid);
        res.status(200).json({ success: true });
    } else { res.status(404).json({ success: false }); }
  } catch (err) { res.status(500).json({ success: false }); }
});

// --- SERVER STARTUP ---
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 NH Mining Server active on port ${PORT}`);
});

// --- RAILWAY SIGTERM FIX ---
// Jab Railway container stop karne ka signal bhejta hai, toh server ko clean exit karna chahiye
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM signal received: Closing HTTP server...');
  server.close(() => {
    console.log('🛑 HTTP server closed.');
    process.exit(0);
  });
});

// Railway connection timeout fix
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
