const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ RAILWAY FIX: Port 8080 aur Host 0.0.0.0
const PORT = process.env.PORT || 8080;

app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Safety Check
if (!supabaseUrl || !supabaseKey) {
    console.error("🚨 ERROR: SUPABASE_URL ya SUPABASE_KEY missing hai!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 🔥 FIX 1: INDIA DATE FUNCTION (Taaki Reset Raat 12 Baje Ho) 🔥
const getTodayDateIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; 
};

// 1. HOME (Health Check)
app.get('/', (req, res) => res.send('NH Mining Server: Live & IST Synced 🇮🇳'));

// 2. REGISTER / LOGIN (🔥 FIX 2: Added Safety for Network Error 🔥)
app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  try {
    // 1. Check existing user
    // 🛑 CHANGE: .single() hata ke .maybeSingle() lagaya (Crash Fix)
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (existingUser) {
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // 🔥 REFERRAL LOGIC START 🔥
    if (referralCode && referralCode.trim() !== "") {
      try {
        const { data: referrer } = await supabase
          .from('users')
          .select('*')
          .ilike('username', referralCode.trim()) 
          .maybeSingle(); // Yahan bhi safety lagayi

        if (referrer) {
          const newCount = (referrer.referral_count || 0) + 1;
          
          await supabase
            .from('users')
            .update({ referral_count: newCount })
            .eq('uid', referrer.uid);
            
          console.log(`✅ Referral Success: ${username} used code ${referralCode}`);
        }
      } catch (refErr) {
        console.error("Referral Error (Ignored):", refErr.message);
      }
    }
    // 🔥 REFERRAL LOGIC END 🔥

    // 3. New User Insert
    const todayDate = getTodayDateIST(); // India Date use ki

    const { error: insertError } = await supabase
      .from('users')
      .insert([{ 
        uid: uid, 
        email: email, 
        username: username,
        phone: phone || null,  
        balance: importedBalance || 1000, 
        referral_count: importedReferralCount || 0,
        today_taps: 0,
        last_active_date: todayDate // ✅ Tere original column me sahi date daali
      }]);

    if (insertError) throw insertError;

    res.status(200).json({ success: true, message: username });

  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. MINING CLAIM (+1 Logic)
app.post('/api/claim', async (req, res) => {
  const { uid, amount } = req.body; 

  try {
    const { data: user } = await supabase.from('users').select('balance').eq('uid', uid).maybeSingle();
    
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const newBalance = (user.balance || 0) + (amount || 1);
    
    await supabase.from('users').update({ balance: newBalance }).eq('uid', uid);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Claim Error:", err.message);
    res.status(500).json({ success: false });
  }
});

// 4. MINING STATS (🔥 DAILY RESET LOGIC FIXED 🔥)
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ success: false });

    // --- 📅 DAILY RESET CHECK START ---
    const todayDate = getTodayDateIST(); // India Date
    
    // Agar DB ki date purani hai
    if (user.last_active_date !== todayDate) {
      console.log(`🌞 New Day for ${user.username}! Resetting taps.`);
      
      await supabase
        .from('users')
        .update({ today_taps: 0, last_active_date: todayDate })
        .eq('uid', uid);

      user.today_taps = 0;
    }
    // --- 📅 DAILY RESET CHECK END ---

    // --- ⚡ MAX LIMIT CALCULATION ---
    const baseLimit = 5000;
    const referralBonus = (user.referral_count || 0) * 500;
    const finalMaxTaps = baseLimit + referralBonus; 

    // Global Stats
    const { data: globalData } = await supabase.from('users').select('balance');
    const globalCirculation = globalData ? globalData.reduce((acc, curr) => acc + (curr.balance || 0), 0) : 0;

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps,
      maxTaps: finalMaxTaps,
      streak: 1, 
      referralCount: user.referral_count,
      globalCirculation: globalCirculation
    });

  } catch (err) {
    console.error("Stats Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. SYNC TAPS
app.post('/api/sync-taps', async (req, res) => {
  const { uid, taps } = req.body;
  try {
    await supabase.from('users').update({ today_taps: taps }).eq('uid', uid);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ✅ SERVER START
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
