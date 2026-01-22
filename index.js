const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ RAILWAY CONFIG
const PORT = process.env.PORT || 8080;

app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("🚨 ERROR: SUPABASE VARS MISSING!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 🔥 FIX: INDIA TIME FUNCTION (Ye zaroori hai taaki Energy Reset na ho)
const getTodayDateIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; 
};

// 1. HOME
app.get('/', (req, res) => res.send('NH Mining Server: Live 🟢'));

// 2. REGISTER / LOGIN
app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  try {
    // Check existing user
    // (Maine .maybeSingle use kiya hai taaki agar user na mile to CRASH na ho)
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (existingUser) {
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // --- REFERRAL LOGIC (Simple & Safe) ---
    if (referralCode && referralCode.trim() !== "") {
      try {
        const { data: referrer } = await supabase
          .from('users')
          .select('*')
          .ilike('username', referralCode.trim()) 
          .maybeSingle();

        if (referrer) {
          const newCount = (referrer.referral_count || 0) + 1;
          // Sirf Count badha rahe hain, kisi ki energy touch nahi kar rahe
          await supabase
            .from('users')
            .update({ referral_count: newCount })
            .eq('uid', referrer.uid);
        }
      } catch (refErr) {
        console.error("Referral Error:", refErr.message);
      }
    }

    // --- NEW USER INSERT ---
    // Yahan hum India wali Date use karenge
    const todayDate = getTodayDateIST();

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
        last_active_date: todayDate // 👈 FIX: India Date
      }]);

    if (insertError) throw insertError;

    res.status(200).json({ success: true, message: username });

  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. CLAIM (+1 Logic)
app.post('/api/claim', async (req, res) => {
  const { uid, amount } = req.body; 
  try {
    const { data: user } = await supabase.from('users').select('balance').eq('uid', uid).maybeSingle();
    
    if (!user) return res.status(404).json({ success: false });

    const newBalance = (user.balance || 0) + (amount || 1);
    await supabase.from('users').update({ balance: newBalance }).eq('uid', uid);
    
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 4. MINING STATS (Isme hai wo main fix)
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    
    if (error) throw error;
    if (!user) return res.status(404).json({ success: false });

    // --- 📅 DATE CHECK ---
    const todayDate = getTodayDateIST(); // India Date check karenge
    
    if (user.last_active_date !== todayDate) {
      // Agar Date alag hai, tabhi reset karo
      await supabase
        .from('users')
        .update({ today_taps: 0, last_active_date: todayDate })
        .eq('uid', uid);
      user.today_taps = 0;
    }

    // --- LIMIT CALCULATION ---
    const baseLimit = 5000;
    const referralBonus = (user.referral_count || 0) * 500;
    const finalMaxTaps = baseLimit + referralBonus; 

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps,
      maxTaps: finalMaxTaps,
      streak: 1, 
      referralCount: user.referral_count,
    });

  } catch (err) {
    res.status(500).json({ success: false });
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
