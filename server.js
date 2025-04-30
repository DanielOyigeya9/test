const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        isAdmin BOOLEAN DEFAULT 0,
        userId TEXT UNIQUE NOT NULL,
        referralCode TEXT UNIQUE NOT NULL,
        earnings REAL DEFAULT 0,
        bandwidthShared REAL DEFAULT 0,
        lastActive TEXT,
        dailyGoal INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS earnings_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        day_0 REAL DEFAULT 0,
        day_1 REAL DEFAULT 0,
        day_2 REAL DEFAULT 0,
        day_3 REAL DEFAULT 0,
        day_4 REAL DEFAULT 0,
        day_5 REAL DEFAULT 0,
        day_6 REAL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        referral_id TEXT NOT NULL,
        earnings REAL DEFAULT 0,
        date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bandwidth_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        speedMbps REAL NOT NULL,
        durationSeconds REAL NOT NULL,
        bandwidthMB REAL NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Create admin user if not exists
    db.get(`SELECT id FROM users WHERE email = ?`, ['admin@dub.com'], (err, row) => {
        if (!row) {
            const adminUserId = 'admin_' + Math.random().toString(36).substr(2, 9);
            const adminReferralCode = 'DUB-ADMIN-' + Math.random().toString(36).substr(2, 4).toUpperCase();
            db.run(`INSERT INTO users (name, email, password, isAdmin, userId, referralCode) 
                    VALUES (?, ?, ?, 1, ?, ?)`, 
                    ['Admin', 'admin@dub.com', 'DUBadmin123!', adminUserId, adminReferralCode]);
        }
    });
});

// API Routes

// User registration
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    
    // Basic validation
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please fill in all fields' });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    const referralCode = 'DUB-' + Math.random().toString(36).substr(2, 4).toUpperCase() + '-' + 
                         Math.random().toString(36).substr(2, 4).toUpperCase();
    
    db.run(`INSERT INTO users (name, email, password, userId, referralCode) 
            VALUES (?, ?, ?, ?, ?)`, 
            [name, email, password, userId, referralCode], 
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'Email already registered' });
                }
                
                // Create empty earnings history
                db.run(`INSERT INTO earnings_history (user_id) VALUES (?)`, [this.lastID]);
                
                res.json({ 
                    success: true, 
                    user: { 
                        email, 
                        name, 
                        userId, 
                        referralCode,
                        isAdmin: false
                    } 
                });
            });
});

// User login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Update last active time
        db.run(`UPDATE users SET lastActive = ? WHERE id = ?`, 
              [new Date().toISOString(), user.id]);
        
        res.json({ 
            success: true, 
            user: { 
                email: user.email, 
                name: user.name, 
                userId: user.userId, 
                referralCode: user.referralCode,
                isAdmin: user.isAdmin,
                earnings: user.earnings,
                dailyGoal: user.dailyGoal
            } 
        });
    });
});

// Get user data
app.get('/api/user/:userId', (req, res) => {
    const { userId } = req.params;
    
    db.get(`SELECT * FROM users WHERE userId = ?`, [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get earnings history
        db.get(`SELECT * FROM earnings_history WHERE user_id = ?`, [user.id], (err, earnings) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Get referrals
            db.all(`SELECT * FROM referrals WHERE user_id = ?`, [user.id], (err, referrals) => {
                const response = {
                    user: {
                        email: user.email,
                        name: user.name,
                        userId: user.userId,
                        referralCode: user.referralCode,
                        isAdmin: user.isAdmin,
                        earnings: user.earnings,
                        bandwidthShared: user.bandwidthShared,
                        dailyGoal: user.dailyGoal,
                        lastActive: user.lastActive
                    },
                    earningsHistory: earnings ? [
                        earnings.day_0,
                        earnings.day_1,
                        earnings.day_2,
                        earnings.day_3,
                        earnings.day_4,
                        earnings.day_5,
                        earnings.day_6
                    ] : new Array(7).fill(0),
                    referrals: referrals || []
                };
                
                res.json(response);
            });
        });
    });
});

// Update user data
app.post('/api/user/:userId/update', (req, res) => {
    const { userId } = req.params;
    const { earnings, bandwidthShared, earningsHistory, dailyGoal } = req.body;
    
    db.get(`SELECT id FROM users WHERE userId = ?`, [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update basic user info
        db.run(`UPDATE users SET 
               earnings = ?,
               bandwidthShared = ?,
               dailyGoal = ?,
               lastActive = ?
               WHERE id = ?`, 
              [earnings, bandwidthShared, dailyGoal, new Date().toISOString(), user.id]);
        
        // Update earnings history
        if (earningsHistory && earningsHistory.length === 7) {
            db.run(`UPDATE earnings_history SET
                   day_0 = ?,
                   day_1 = ?,
                   day_2 = ?,
                   day_3 = ?,
                   day_4 = ?,
                   day_5 = ?,
                   day_6 = ?
                   WHERE user_id = ?`,
                  [...earningsHistory, user.id]);
        }
        
        res.json({ success: true });
    });
});

// Add referral
app.post('/api/user/:userId/referral', (req, res) => {
    const { userId } = req.params;
    const { earnings } = req.body;
    
    db.get(`SELECT id FROM users WHERE userId = ?`, [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const referralId = 'ref_' + Math.random().toString(36).substr(2, 6);
        
        db.run(`INSERT INTO referrals (user_id, referral_id, earnings, date)
               VALUES (?, ?, ?, ?)`,
              [user.id, referralId, earnings, new Date().toISOString()], 
              function(err) {
                  if (err) {
                      return res.status(500).json({ error: 'Database error' });
                  }
                  
                  res.json({ success: true });
              });
    });
});

// Add bandwidth data
app.post('/api/user/:userId/bandwidth', (req, res) => {
    const { userId } = req.params;
    const { timestamp, speedMbps, durationSeconds, bandwidthMB } = req.body;
    
    db.get(`SELECT id FROM users WHERE userId = ?`, [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        db.run(`INSERT INTO bandwidth_data (user_id, timestamp, speedMbps, durationSeconds, bandwidthMB)
               VALUES (?, ?, ?, ?, ?)`,
              [user.id, timestamp, speedMbps, durationSeconds, bandwidthMB], 
              function(err) {
                  if (err) {
                      return res.status(500).json({ error: 'Database error' });
                  }
                  
                  res.json({ success: true });
              });
    });
});

// Admin routes
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT * FROM users`, [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(users);
    });
});

app.get('/api/admin/bandwidth', (req, res) => {
    db.all(`SELECT * FROM bandwidth_data`, [], (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(data);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});