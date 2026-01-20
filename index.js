const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. HOME
app.get('/', (req, res) => res.send('NH Mining Server: Live 🟢'));

// 2. REGISTER / LOGIN (With Migration Logic)
app.post('/api/register', async (req, res) => {
  // importedReferralCount: Jo Firebase se aayega
  const { uid, email, username, phone, importedBalance, importedReferralCount } = req.body;

  try {
    // Check existing
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (existingUser) {
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // New User Create (With Old Data if available)
    const { error: insertError } = await supabase
      .from('users')
      .insert([{ 
        uid: uid, 
        email: email, 
        username: username,
        phone: phone || null,
        balance: importedBalance || 1000, // 🎁 Agar purana balance nahi hai to 1000 Bonus
        referral_count: importedReferralCount || 0, // 👥 Purane referrals yahan set honge
        today_taps: 0
      }]);

    if (insertError) throw insertError;

    res.status(200).json({ success: true, message: username });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. MINING UPDATE (+1 Logic)
app.post('/api/claim', async (req, res) => {
  const { userId, amount } = req.body;
  try {
    // RPC use nahi kar rahe, simple read-write (safe enough for this scale)
    const { data: user } = await supabase.from('users').select('balance').eq('uid', userId).single();
    const newBalance = (user?.balance || 0) + (amount || 1);
    
    await supabase.from('users').update({ balance: newBalance }).eq('uid', userId);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 4. MINING STATS (Dynamic Limit Logic Here)
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error) throw error;

    // 🔥 LOGIC: DAILY LIMIT CALCULATION 🔥
    const baseLimit = 5000;
    const referralBonus = (user.referral_count || 0) * 500;
    const finalMaxTaps = baseLimit + referralBonus; 

    // Global Stats Query (Simple Sum)
    const { data: globalData } = await supabase.from('users').select('balance');
    const globalCirculation = globalData ? globalData.reduce((acc, curr) => acc + (curr.balance || 0), 0) : 0;

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps,
      maxTaps: finalMaxTaps, // 👈 Ye calculate hoke app pe jayega
      streak: 1, 
      referralCount: user.referral_count,
      globalCirculation: globalCirculation
    });

  } catch (err) {
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

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
