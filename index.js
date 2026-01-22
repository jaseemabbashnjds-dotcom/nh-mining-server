const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
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

// ✅ Helper: India Date Function (IST)
const getTodayDateIST = () => {
    const now = new Date();
    // UTC se 5.5 hours add karke India time nikalo
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; // Returns 'YYYY-MM-DD'
};

app.get('/', (req, res) => res.send('NH Mining Server: Live & IST Synced 🇮🇳'));

// 1. REGISTER API
app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  console.log(`📝 Register Request: ${username} (${uid})`); // Log start

  try {
    // A. Check if user already exists
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle(); 

    if (findError) {
        console.error("❌ Find User Error:", findError.message);
        throw findError;
    }

    if (existingUser) {
      console.log("✅ User already exists. Logging in.");
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // B. Referral Logic (Safe Mode)
    if (referralCode && referralCode.trim() !== "") {
      try {
        const { data: referrer } = await supabase
          .from('users')
          .select('*')
          .ilike('username', referralCode.trim()) 
          .maybeSingle();

        if (referrer) {
          const newCount = (referrer.referral_count || 0) + 1;
          await supabase
            .from('users')
            .update({ referral_count: newCount })
            .eq('uid', referrer.uid);
          console.log(`🔗 Referral Applied: ${referralCode}`);
        }
      } catch (e) {
        console.log("⚠️ Referral Error (Skipped):", e.message);
      }
    }

    // C. New User Insert
    // Ensure Phone is either a valid string or NULL (Empty string fails in some DBs)
    const finalPhone = phone && phone.trim().length > 0 ? phone : null;
    
    // IST Date Generate Karo
    const todayDate = getTodayDateIST(); 

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
        last_active_date: todayDate // ✅ WAPAS DAAL DIYA (Screenshot verified)
      }]);

    if (insertError) {
        // 🔥 Yahan Asli Error Print Hoga
        console.error("❌ INSERT ERROR:", insertError.message, insertError.details);
        throw insertError;
    }

    console.log("🎉 New User Registered Successfully!");
    res.status(200).json({ success: true, message: username });

  } catch (err) {
    console.error("💥 SERVER CRASH ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server Error: " + err.message });
  }
});

// 2. CLAIM API
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

// 3. STATS API
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (!user) return res.status(404).json({ success: false });

    // --- 📅 DAILY RESET CHECK (IST) ---
    const todayDate = getTodayDateIST();
    
    // Agar Date match nahi karti (User purane din se aaya hai)
    if (user.last_active_date !== todayDate) {
      console.log(`🔄 Resetting Taps for ${user.username} (New Day)`);
      
      await supabase
        .from('users')
        .update({ today_taps: 0, last_active_date: todayDate })
        .eq('uid', uid);

      user.today_taps = 0; 
    }

    // Limit Calculation
    const baseLimit = 5000;
    const referralBonus = (user.referral_count || 0) * 500;
    const finalMaxTaps = baseLimit + referralBonus; 

    // Global Stats
    const { data: globalData } = await supabase.from('users').select('balance');
    const globalCirculation = globalData ? globalData.reduce((acc, curr) => acc + (curr.balance || 0), 0) : 0;

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps || 0,
      maxTaps: finalMaxTaps,
      streak: 1, 
      referralCount: user.referral_count,
      globalCirculation: globalCirculation
    });

  } catch (err) {
    console.error("Stats Error:", err.message);
    res.status(500).json({ success: false });
  }
});

// 4. SYNC API
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
