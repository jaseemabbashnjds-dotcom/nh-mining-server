const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

// 🔥 CRASH HANDLER: Global error catching taaki server band na ho
process.on('uncaughtException', (err) => {
  console.error('💥 Critical Error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();

// Railway dynamics port handle karne ke liye
const PORT = process.env.PORT || 8080;

app.use(express.json()); 
app.use(cors());

// Supabase Connection setup with validation
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey) {
    console.error("🚨 ERROR: Supabase Variables Missing! Dashboard check karein.");
} else {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log("⚡ Supabase Client Initialized");
    } catch (e) {
        console.error("🚨 Supabase Init Failed:", e.message);
    }
}

// 🇮🇳 INDIA TIME HELPER
const getTodayDateIST = () => {
    const now = new Date();
    // Indian Standard Time (UTC +5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istTime.toISOString().split('T')[0]; 
};

// Health Check Route (Isse Railway ko pata chalta hai ki server zinda hai)
app.get('/', (req, res) => res.status(200).send('NH Mining Server: Live & Ready 🟢'));

// ✅ REGISTER API
app.post('/api/register', async (req, res) => {
  if (!supabase) return res.status(500).json({ success: false, message: "Database not connected" });
  
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
      const { data: referrer } = await supabase.from('users').select('*').ilike('username', referralCode).maybeSingle();
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

// ✅ CLAIM API
app.post('/api/claim', async (req, res) => {
  const { uid, amount } = req.body; 
  try {
    const { data: user } = await supabase.from('users').select('balance').eq('uid', uid).maybeSingle();
    if (!user) return res.status(404).json({ success: false });

    await supabase.from('users').update({ balance: (user.balance || 0) + (amount || 1) }).eq('uid', uid);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ✅ STATS API
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (!user) return res.status(404).json({ success: false });

    const todayDate = getTodayDateIST();
    
    if (user.last_active_date !== todayDate) {
      await supabase.from('users').update({ today_taps: 0, last_active_date: todayDate }).eq('uid', uid);
      user.today_taps = 0;
    }

    const baseLimit = 5000;
    const referralBonus = (user.referral_count || 0) * 500;
    
    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps,
      maxTaps: baseLimit + referralBonus,
      referralCount: user.referral_count,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ✅ SYNC API
app.post('/api/sync-taps', async (req, res) => {
  const { uid, taps } = req.body;
  try {
    await supabase.from('users').update({ today_taps: taps }).eq('uid', uid);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 NH Mining Server active on port ${PORT}`);
});
