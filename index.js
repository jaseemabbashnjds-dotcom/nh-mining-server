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

// 🔥 1. SPECIAL FUNCTION: INDIA DATE (IST) 🔥
// Ye function hamesha India ki "Aaj ki Tareekh" dega (YYYY-MM-DD)
const getTodayDateIST = () => {
    const now = new Date();
    // UTC se 5 ghante 30 min aage (India Time)
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; 
};

// 2. HOME
app.get('/', (req, res) => res.send('NH Mining Server: Live & IST Synced 🇮🇳'));

// 3. REGISTER / LOGIN (✅ CRASH FIXED HERE)
app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  try {
    // 🛑 CHANGE: .single() ki jagah .maybeSingle() use kiya
    // Taaki agar user na mile toh crash na ho
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle(); 

    if (existingUser) {
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // --- REFERRAL LOGIC ---
    if (referralCode && referralCode.trim() !== "") {
      try {
        // 🛑 CHANGE: Yahan bhi .maybeSingle() lagaya
        const { data: referrer } = await supabase
          .from('users')
          .select('*')
          .ilike('username', referralCode.trim()) 
          .maybeSingle();

        if (referrer) {
          // Sirf Referral Count badhaya (Energy Reset nahi ki) ✅
          const newCount = (referrer.referral_count || 0) + 1;
          
          await supabase
            .from('users')
            .update({ referral_count: newCount })
            .eq('uid', referrer.uid);
            
          console.log(`✅ Referral: ${username} -> ${referralCode}`);
        }
      } catch (refErr) {
        console.error("Referral Error (Ignored):", refErr.message);
      }
    }

    // --- NEW USER INSERT ---
    // Phone empty string ko null banana zaroori hai
    const finalPhone = phone && phone.trim() !== "" ? phone : null;

    const { error: insertError } = await supabase
      .from('users')
      .insert([{ 
        uid: uid, 
        email: email, 
        username: username,
        phone: finalPhone,  
        balance: importedBalance || 1000, 
        referral_count: importedReferralCount || 0,
        today_taps: 0,
        last_active_date: getTodayDateIST() // 👈 INDIA DATE
      }]);

    if (insertError) throw insertError;

    res.status(200).json({ success: true, message: username });

  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. CLAIM / MINING (+1)
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

// 5. MINING STATS (🔥 RESET LOGIC FIXED 🔥)
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    
    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // --- 📅 DAILY RESET CHECK (INDIA TIME) ---
    const todayDate = getTodayDateIST(); // 👈 India ki date nikali
    let currentTaps = user.today_taps;

    // Agar DB ki date alag hai, toh Reset karo
    if (user.last_active_date !== todayDate) {
      console.log(`🇮🇳 New Day for ${user.username}! Resetting taps.`);
      
      await supabase
        .from('users')
        .update({ today_taps: 0, last_active_date: todayDate })
        .eq('uid', uid);

      currentTaps = 0; // Turant response ke liye 0 set kiya
    }

    // --- ⚡ MAX LIMIT CALCULATION ---
    const baseLimit = 5000;
    const referralBonus = (user.referral_count || 0) * 500;
    
    // Yahan sirf LIMIT badh rahi hai, 'today_taps' (kharch) wahi hai.
    const finalMaxTaps = baseLimit + referralBonus; 

    // Global Stats
    const { data: globalData } = await supabase.from('users').select('balance');
    const globalCirculation = globalData ? globalData.reduce((acc, curr) => acc + (curr.balance || 0), 0) : 0;

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: currentTaps,
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

// 6.
