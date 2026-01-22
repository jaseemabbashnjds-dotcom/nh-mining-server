const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

// 🔥 CRASH HANDLER: Ye Server ko Marne Nahi Dega 🔥
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Server Zinda rahega:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION! Karan:', reason);
});

const app = express();
// Railway Port Setup
const PORT = process.env.PORT || 8080;

app.use(express.json()); 
app.use(cors());

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("🚨 ERROR: Supabase Variables Missing in Railway!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 🔍 STARTUP TEST: Check if Supabase is Connected
async function testConnection() {
    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) {
            console.error("❌ SUPABASE CONNECTION FAILED:", error.message);
        } else {
            console.log("✅ SUPABASE CONNECTED SUCCESSFULLY!");
        }
    } catch (e) {
        console.error("❌ SUPABASE CRASH:", e.message);
    }
}
testConnection(); // Server start hote hi check karega

// Date Helper
const getTodayDateIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; 
};

// Routes
app.get('/', (req, res) => res.send('NH Mining Server is Running 🟢'));

app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;
  console.log(`➡️ Register Request: ${username}`);

  try {
    const { data: existingUser } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();

    if (existingUser) {
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    if (referralCode) {
       // Simple Referral Logic
       const { data: referrer } = await supabase.from('users').select('*').ilike('username', referralCode).maybeSingle();
       if (referrer) {
           await supabase.from('users').update({ referral_count: (referrer.referral_count || 0) + 1 }).eq('uid', referrer.uid);
       }
    }

    const todayDate = getTodayDateIST();
    
    // Insert New User
    const { error: insertError } = await supabase.from('users').insert([{ 
        uid, email, username, 
        phone: phone || null,  
        balance: importedBalance || 1000, 
        referral_count: importedReferralCount || 0,
        today_taps: 0,
        last_active_date: todayDate 
    }]);

    if (insertError) {
        console.error("❌ INSERT ERROR:", insertError.message);
        throw insertError;
    }

    res.status(200).json({ success: true, message: username });

  } catch (err) {
    console.error("💥 REGISTER API ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Baaki APIs (Claim/Stats/Sync)
app.post('/api/claim', async (req, res) => {
    /* Wahi purana code */
    const { uid, amount } = req.body;
    await supabase.rpc('increment_balance', { uid, amount: amount || 1 }); // Optimization: agar RPC nahi hai to purana logic use kar
    res.json({success: true});
}); 
// (Main logic register ka hi tha, baaki APIs waise hi rehne de jo pehle thin)
// Agar tere paas purana code hai stats/claim ka toh wo paste kar dena neeche.

// SERVER LISTEN
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
