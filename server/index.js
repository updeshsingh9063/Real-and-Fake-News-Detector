const express = require("express");
const cors = require("cors");
const { v4: uuid } = require("uuid");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// MongoDB Connection
// -----------------------------
mongoose.connect("mongodb://127.0.0.1:27017/personalization")
    .then(() => console.log("MongoDB connected (personalization)"))
    .catch(err => console.error("Mongo error:", err));

const misinfoDb = mongoose.createConnection("mongodb://127.0.0.1:27017/misinformation_db");
misinfoDb.on('connected', () => console.log('MongoDB connected (misinformation_db)'));
misinfoDb.on('error', err => console.error('Mongo error (misinformation_db):', err));

// -----------------------------
// Schema
// -----------------------------
const UserSchema = new mongoose.Schema({
    id: String,
    sessionCount: Number,
    interests: Object,
    history: Array,
    createdAt: Number,
    lastActive: Number
});

const User = mongoose.model("User", UserSchema);

const AnalysisSchema = new mongoose.Schema({
    text: String,
    label: String,
    confidence: Number,
    explanation: String,
    createdAt: { type: Date, default: Date.now }
});
const Analysis = misinfoDb.model("Analysis", AnalysisSchema, "analyses");

// -----------------------------
// Get or create user
// -----------------------------
app.get("/user", async (req, res) => {
    try {
        let user = await User.findOne({ id: req.query.id });

        if (!user) {
            user = await User.create({
                id: req.query.id || uuid(),
                sessionCount: 1,
                interests: {},
                history: [],
                createdAt: Date.now(),
                lastActive: Date.now()
            });
        } else {
            user.sessionCount += 1;
            user.lastActive = Date.now();
            await user.save();
        }

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "User fetch failed" });
    }
});

// -----------------------------
// Track events + Interest Engine
// -----------------------------
app.post("/track", async (req, res) => {
    try {
        const { userId, event } = req.body;

        const user = await User.findOne({ id: userId });
        if (!user) return res.status(404).send("User not found");

        // Save event
        user.history.push({
            ...event,
            timestamp: Date.now()
        });

        // Keep history size safe
        if (user.history.length > 100) {
            user.history.shift();
        }

        // -----------------------------
        // Interest Engine (core logic)
        // -----------------------------
        if (event.type === "click" && event.category) {
            const cat = event.category;

            if (!user.interests[cat]) {
                user.interests[cat] = 0;
            }

            // boost interest
            user.interests[cat] += 0.1;
        }

        // decay all interests slowly
        Object.keys(user.interests).forEach(key => {
            user.interests[key] *= 0.995;
        });

        user.lastActive = Date.now();

        await user.save();

        res.sendStatus(200);
    } catch (err) {
        res.status(500).send("Tracking failed");
    }
});

// -----------------------------
// Update profile
// -----------------------------
app.post("/profile", async (req, res) => {
    try {
        const { userId, profile } = req.body;

        await User.updateOne(
            { id: userId },
            { $set: profile }
        );

        res.sendStatus(200);
    } catch (err) {
        res.status(500).send("Profile update failed");
    }
});

// -----------------------------
// Misinformation Detection API
// -----------------------------
app.post("/api/detect", async (req, res) => {
    try {
        const { text, userId } = req.body;
        
        if (!text) return res.status(400).json({ error: "Text is required" });

        // Call the Python ML Service
        const mlResponse = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        if (!mlResponse.ok) {
            throw new Error(`ML service responded with status: ${mlResponse.status}`);
        }

        const data = await mlResponse.json();

        // Save to misinformation_db > analyses collection
        await Analysis.create({
            text: text,
            label: data.label,
            confidence: data.confidence,
            explanation: data.explanation
        });

        // If user is provided, we could optionally track this detection event
        if (userId) {
            const user = await User.findOne({ id: userId });
            if (user) {
                user.history.push({
                    type: "detect",
                    textPreview: text.substring(0, 50),
                    label: data.label,
                    confidence: data.confidence,
                    timestamp: Date.now()
                });
                if (user.history.length > 100) user.history.shift();
                await user.save();
            }
        }

        res.json(data);
    } catch (err) {
        console.error("Detection failed:", err);
        res.status(500).json({ error: "Detection failed" });
    }
});

// -----------------------------
// Start server
// -----------------------------
app.listen(5000, () =>
    console.log("Backend running on http://localhost:5000")
);