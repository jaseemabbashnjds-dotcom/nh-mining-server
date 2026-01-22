Const express = require('express');
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
    console.error("🚨 ERROR: SUPABASE_URL ya SUPABASE_KEY missing hai! Railway Variables check karo.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. HOME (Health Check)
app.get('/', (req, res) => res.send('NH Mining Server: Live 🟢'));

// 2. REGISTER / LOGIN (Referral Logic Included)
app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  try {
    // 1. Check existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

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
          .single();

        if (referrer) {
          const newCount = (referrer.referral_count || 0) + 1;
          
          await supabase
            .from('users')
            .update({ referral_count: newCount })
            .eq('uid', referrer.uid);
            
          console.log(`✅ Referral Success: ${username} used code ${referralCode}`);
        } else {
          console.log(`❌ Invalid Referral Code: ${referralCode}`);
        }
      } catch (refErr) {
        console.error("Referral Error (Ignored):", refErr.message);
      }
    }
    // 🔥 REFERRAL LOGIC END 🔥

    // 3. New User Insert
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
        last_active_date: new Date().toISOString().split('T')[0] // Aaj ki date set karo
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
    const { data: user } = await supabase.from('users').select('balance').eq('uid', uid).single();
    
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const newBalance = (user.balance || 0) + (amount || 1);
    
    await supabase.from('users').update({ balance: newBalance }).eq('uid', uid);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Claim Error:", err.message);
    res.status(500).json({ success: false });
  }
});

// 4. MINING STATS (🔥 DAILY RESET LOGIC ADDED HERE 🔥)
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error) throw error;

    // --- 📅 DAILY RESET CHECK START ---
    // Aaj ki date nikalo (YYYY-MM-DD format me)
    const todayDate = new Date().toISOString().split('T')[0]; 
    
    // Agar DB ki date purani hai, matlab naya din shuru ho gaya
    if (user.last_active_date !== todayDate) {
      console.log(`🌞 New Day for ${user.username}! Resetting taps.`);
      
      // DB me Taps 0 kar do aur Date update kar do
      await supabase
        .from('users')
        .update({ today_taps: 0, last_active_date: todayDate })
        .eq('uid', uid);

      // Local variable bhi 0 kar do taaki user ko abhi turant 0 dikhe
      user.today_taps = 0;
    }
    // --- 📅 DAILY RESET CHECK END ---

    // --- ⚡ MAX LIMIT CALCULATION (Referral Limit Logic) ---
    // Base Limit: 5000
    // Referral Bonus: 500 per referral
    const baseLimit = 5000;
    const referralBonus = (user.referral_count || 0) * 500;
    
    // Agar 7 referrals hain: 5000 + (7*500) = 8500 Limit banegi
    const finalMaxTaps = baseLimit + referralBonus; 


    // Global Stats
    const { data: globalData } = await supabase.from('users').select('balance');
    const globalCirculation = globalData ? globalData.reduce((acc, curr) => acc + (curr.balance || 0), 0) : 0;

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps, // Ye reset hoke 0 aayega agar naya din hai
      maxTaps: finalMaxTaps,        // Ye 8500 hi rahega (Referral add hoke)
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