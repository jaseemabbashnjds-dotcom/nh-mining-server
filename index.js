const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

// 🔥 CRASH HANDLER: Server ko marne nahi dega
process.on('uncaughtException', (err) => {
  console.error('💥 Error aaya par Server Zinda hai:', err);
});

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("🚨 ERROR: Supabase Variables Missing!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 🇮🇳 INDIA TIME HELPER (Reset ke liye)
const getTodayDateIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; 
};

app.get('/', (req, res) => res.send('NH Mining Server: Live & Ready 🟢'));

// ✅ REGISTER API (Minimum 1000 Balance Logic)
app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  try {
    // 🔍 STEP 1: CHECK EXISTING USER
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle(); 

    // 👇 AGAR BANDA PEHLE SE HAI (Purana User) 👇
    if (existingUser) {
      console.log(`👤 Old User Login: ${existingUser.username} | Current Balance: ${existingUser.balance}`);
      
      // TERA LOGIC: Agar balance 1000 se kam hai, toh 1000 karo.
      // Agar 1000 ya usse zyada hai, toh waisa hi rehne do.
      if ((existingUser.balance || 0) < 1000) {
          console.log("⚠️ Balance kam tha (<1000), Top-up kar rahe hain...");
          
          await supabase
            .from('users')
            .update({ balance: 1000 })
            .eq('uid', uid);
            
          console.log("✅ Balance updated to 1000.");
      } else {
          console.log("✅ Balance Sahi hai (>1000), No Change.");
      }

      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // ===================================================
    // 🚧 ISKE NEECHE SIRF NAYE BANDO KE LIYE HAI 🚧
    // ===================================================

    // STEP 2: Referral Logic (New User Only)
    if (referralCode && referralCode.trim() !== "") {
      try {
        const { data: referrer } = await supabase.from('users').select('*').ilike('username', referralCode).maybeSingle();
        if (referrer) {
           await supabase.from('users').update({ referral_count: (referrer.referral_count || 0) + 1 }).eq('uid', referrer.uid);
        }
      } catch (e) { /* Ignore */ }
    }

    // STEP 3: Naya Account Insert (1000 Bonus Fixed)
    const todayDate = getTodayDateIST();
    
    // Agar Firebase se kuch aaya hai to theek, warna seedha 1000
    let startingBalance = 1000;
    if (importedBalance && Number(importedBalance) > 1000) {
        startingBalance = Number(importedBalance);
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert([{ 
        uid: uid, 
        email: email, 
        username: username,
        phone: phone || null,
        
        balance: startingBalance, // ✅ Guaranteed 1000 Check
        
        referral_count: importedReferralCount || 0,
        today_taps: 0,
        last_active_date: todayDate 
      }]);

    if (insertError) throw insertError;

    console.log(`🎉 New User Registered: ${username} with 1000 Notes`);
    res.status(200).json({ success: true, message: username });

  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
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

// ✅ STATS API (With India Time Reset)
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (!user) return res.status(404).json({ success: false });

    const todayDate = getTodayDateIST();
    
    // Auto Reset Logic (Sirf Taps Reset honge, Balance nahi)
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
