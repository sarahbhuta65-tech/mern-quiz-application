import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
dotenv.config();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const MONGO_URL = process.env.MONGO_URL || process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "changeme_in_production";
const TEACHER_INVITE_CODE = process.env.TEACHER_INVITE_CODE || "TEACH2024";

if (!MONGO_URL) {
    console.error("❌ ERROR: MONGO_URL is missing in your .env file!");
    process.exit(1);
}

mongoose.connect(MONGO_URL)
    .then(() => {
        console.log("☁️  Connected to MongoDB successfully!");
        app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    })
    .catch(err => console.log("❌ MongoDB Error:", err.message));

// ── SCHEMAS ──────────────────────────────────────────────

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, default: "student" }
});

const quizSchema = new mongoose.Schema({
    code:      { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },   // teacher username
    questions: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

const resultSchema = new mongoose.Schema({
    studentName:    String,
    quizCode:       String,
    totalQuestions: Number,
    correctAnswers: Number,
    percentage:     Number,
    status:         String,
    tabSwitched:    { type: Boolean, default: false },
    date:           { type: String, default: () => new Date().toLocaleString() }
});

const User   = mongoose.model("User",   userSchema,   "users");
const Quiz   = mongoose.model("Quiz",   quizSchema,   "quizzes");
const Result = mongoose.model("Result", resultSchema, "results");

// ── AUTH MIDDLEWARE ───────────────────────────────────────

function verifyToken(req, res, next) {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided." });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(403).json({ error: "Invalid or expired token." });
    }
}

function requireInstructor(req, res, next) {
    if (req.user?.role !== "instructor")
        return res.status(403).json({ error: "Instructor access only." });
    next();
}

// ── ROUTES ────────────────────────────────────────────────

// 1. STUDENT SIGNUP
app.post("/api/signup", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: "Username and password required." });

        if (await User.findOne({ username }))
            return res.status(400).json({ error: "Username already taken." });

        const hashed = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashed, role: "student" });
        res.status(201).json({ message: "Account created successfully." });
    } catch (err) {
        res.status(500).json({ error: "Signup failed: " + err.message });
    }
});

// 2. TEACHER SIGNUP (requires invite code)
app.post("/api/teacher-signup", async (req, res) => {
    try {
        const { username, password, inviteCode } = req.body;
        if (!username || !password || !inviteCode)
            return res.status(400).json({ error: "All fields required." });

        if (inviteCode !== TEACHER_INVITE_CODE)
            return res.status(403).json({ error: "Invalid invite code." });

        if (await User.findOne({ username }))
            return res.status(400).json({ error: "Username already taken." });

        const hashed = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashed, role: "instructor" });
        res.status(201).json({ message: "Instructor account created." });
    } catch (err) {
        res.status(500).json({ error: "Signup failed: " + err.message });
    }
});

// 3. UNIFIED LOGIN
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.status(401).json({ error: "Invalid username or password." });

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: "8h" }
        );
        res.json({ message: "Login Success", username: user.username, role: user.role, token });
    } catch (err) {
        res.status(500).json({ error: "Login error." });
    }
});

// 4. SAVE QUIZ (teacher only — stored in MongoDB with createdBy)
app.post("/api/quiz", verifyToken, requireInstructor, async (req, res) => {
    try {
        const { code, questions } = req.body;
        if (!code || !questions?.length)
            return res.status(400).json({ error: "Quiz code and questions required." });

        // Upsert — update if exists, create if not
        await Quiz.findOneAndUpdate(
            { code, createdBy: req.user.username },
            { code, createdBy: req.user.username, questions },
            { upsert: true, new: true }
        );
        res.status(201).json({ message: "Quiz published successfully." });
    } catch (err) {
        if (err.code === 11000)
            return res.status(400).json({ error: "Quiz code already exists. Use a different code." });
        res.status(500).json({ error: "Failed to save quiz: " + err.message });
    }
});

// 5. GET MY QUIZZES (teacher — only their own)
app.get("/api/quiz", verifyToken, requireInstructor, async (req, res) => {
    try {
        const quizzes = await Quiz.find({ createdBy: req.user.username }).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. DELETE QUIZ (teacher — only their own)
app.delete("/api/quiz/:code", verifyToken, requireInstructor, async (req, res) => {
    try {
        const result = await Quiz.findOneAndDelete({ code: req.params.code, createdBy: req.user.username });
        if (!result) return res.status(404).json({ error: "Quiz not found or not yours." });
        res.json({ message: "Quiz deleted." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. GET QUIZ BY CODE (student — to take the quiz)
app.get("/api/quiz/:code", verifyToken, async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ code: req.params.code });
        if (!quiz) return res.status(404).json({ error: "Invalid quiz code." });
        res.json({ questions: quiz.questions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. SAVE RESULT (student)
app.post("/api/save-result", verifyToken, async (req, res) => {
    try {
        await Result.create(req.body);
        res.status(201).json({ message: "Result saved." });
    } catch (err) {
        res.status(500).json({ error: "Failed to save result: " + err.message });
    }
});

// 9. GET MY RESULTS (student — own records only)
app.get("/api/my-results", verifyToken, async (req, res) => {
    try {
        const results = await Result.find({ studentName: req.user.username }).sort({ _id: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. GET RESULTS FOR MY QUIZZES (teacher — filtered by ownership)
app.get("/getResults", verifyToken, requireInstructor, async (req, res) => {
    try {
        const myQuizzes = await Quiz.find({ createdBy: req.user.username });
        const myCodes = myQuizzes.map(q => q.code);
        const results = await Result.find({ quizCode: { $in: myCodes } }).sort({ _id: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. LEADERBOARD for a quiz
app.get("/api/leaderboard/:quizCode", verifyToken, async (req, res) => {
    try {
        const results = await Result.find({ quizCode: req.params.quizCode, tabSwitched: false })
            .sort({ percentage: -1 }).limit(5);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
