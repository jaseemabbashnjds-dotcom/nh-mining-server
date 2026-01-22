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
    console.error("🚨 CRITICAL ERROR: Supabase Variables Missing!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const getTodayDateIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; 
};

app.get('/', (req, res) => res.send('NH Mining Server: Live & Ready 🟢'));

// 🛑 DEBUG REGISTER ROUTE 🛑
app.post('/api/register', async (req, res) => {
  const { uid, email, username, phone, importedBalance, importedReferralCount, referralCode } = req.body;

  // 1. Log Incoming Data
  console.log(`➡️ Register Request Received for: ${username}`);
  console.log(`➡️ Data: UID=${uid}, Phone=${phone}`);

  try {
    // 2. Check Existing User
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle(); 

    if (findError) {
        console.error("❌ Database Read Error:", findError.message);
        return res.status(500).json({ success: false, message: "DB Read Failed" });
    }

    if (existingUser) {
      console.log("✅ User already exists.");
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // 3. Referral (Skipping logs for brevity)
    if (referralCode && referralCode.trim() !== "") {
       // ... (Referral logic same as before)
    }

    // 4. Try Insert
    const todayDate = getTodayDateIST(); 
    
    // Check Phone Value
    const finalPhone = phone && phone.trim() !== "" ? phone : null;

    console.log("⏳ Attempting Insert...");
    
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
        last_active_date: todayDate 
      }]);

    if (insertError) {
        // 🔥 ASLI ERROR YAHAN PAKDA JAYEGA 🔥
        console.error("❌ INSERT FAILED. REASON:", insertError.message);
        console.error("❌ DETAILS:", insertError.details);
        console.error("❌ HINT:", insertError.hint);
        
        throw insertError; // Ye catch block me jayega
    }

    console.log("🎉 Insert Successful!");
    res.status(200).json({ success: true, message: username });

  } catch (err) {
    console.error("💥 FINAL SERVER CRASH:", err.message);
    // Client ko batao error kya hai
    res.status(500).json({ success: false, message: err.message });
  }
});

// ... (Baaki Claim/Stats APIs same rahenge)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
