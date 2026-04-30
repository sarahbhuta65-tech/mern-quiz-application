// --- GLOBAL STATE ---
let quizQuestions = [];
let currentIdx = 0;
let score = 0;
let quizStarted = false;
let tabSwitched = false;
let timerSeconds = 300; 
let countdownInterval;

const SERVER_URL = "http://localhost:8000";

/**
 * 1. START QUIZ
 */
async function startQuiz() {
    const code = document.getElementById("quizCode").value.trim();
    // Always use the logged-in username as the student name
    const name = localStorage.getItem("studentName") || document.getElementById("studentName").value.trim();

    if (!name || !code) return alert("Please enter both Name and Quiz Code.");

    const token = localStorage.getItem("authToken");

    try {
        const res = await fetch(`${SERVER_URL}/api/quiz/${code}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            alert("Invalid Quiz Code! Make sure the server is running.");
            return;
        }

        const data = await res.json();
        quizQuestions = data.questions;

        sessionStorage.setItem("currentStudent", name);
        sessionStorage.setItem("activeCode", code);

        document.getElementById("startScreen").style.display = "none";
        document.getElementById("quizSection").style.display = "block";

        quizStarted = true;
        loadQuestion();
        startTimer();
    } catch (e) {
        alert("Connection failed. Make sure the server is running on port 8000.");
    }
}

/**
 * 2. RENDER QUESTION
 */
function loadQuestion() {
    const q = quizQuestions[currentIdx];
    document.getElementById("questionText").innerText = q.question;
    document.getElementById("qCount").innerText = `Question ${currentIdx + 1} of ${quizQuestions.length}`;
    
    const progressPercent = ((currentIdx + 1) / quizQuestions.length) * 100;
    document.getElementById("progress").style.width = progressPercent + "%";

    const optionsDiv = document.getElementById("options");
    optionsDiv.innerHTML = "";

    ["A", "B", "C", "D"].forEach(key => {
        if (q.options[key]) {
            optionsDiv.innerHTML += `
                <div class="option-card" onclick="selectOption('${key}')" id="card${key}">
                    <div class="option-key">${key}</div>
                    <input type="radio" name="quizOpt" id="opt${key}" value="${key}" style="display:none;">
                    <span class="option-label">${q.options[key]}</span>
                </div>
            `;
        }
    });

    const btn = document.getElementById("nextBtn");
    btn.innerHTML = (currentIdx === quizQuestions.length - 1) ? "Submit Quiz" : "Next Question";
}

window.selectOption = function(key) {
    const radio = document.getElementById("opt" + key);
    if (radio) {
        radio.checked = true;
        document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        document.getElementById("card" + key).classList.add('selected');
    }
};

document.getElementById("nextBtn").onclick = function() {
    const selected = document.querySelector('input[name="quizOpt"]:checked');
    if (!selected) return alert("Please select an answer.");

    if (selected.value === quizQuestions[currentIdx].correctAnswer) score++;

    if (currentIdx < quizQuestions.length - 1) {
        currentIdx++;
        loadQuestion();
    } else {
        finishQuiz();
    }
};

/**
 * 3. SECURITY & TIMER
 */
function startTimer() {
    countdownInterval = setInterval(() => {
        if (timerSeconds <= 0) { finishQuiz(); return; }
        timerSeconds--;
        const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
        const s = String(timerSeconds % 60).padStart(2, '0');
        const el = document.getElementById("timer");
        if (el) el.innerText = `${m}:${s}`;
    }, 1000);
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden && quizStarted) {
        tabSwitched = true;
        alert("⚠️ SECURITY BREACH: Tab switching detected.");
        finishQuiz();
    }
});

window.addEventListener("blur", () => {
    if (quizStarted) {
        tabSwitched = true;
        alert("⚠️ SECURITY BREACH: Window switching detected.");
        finishQuiz();
    }
});

/**
 * 4. FINAL SUBMIT TO SERVER
 */
async function finishQuiz() {
    quizStarted = false;
    clearInterval(countdownInterval);
    
    const percentage = Math.round((score / quizQuestions.length) * 100);
    const cheated = tabSwitched;
    const resultData = {
        studentName:    sessionStorage.getItem("currentStudent"),
        quizCode:       sessionStorage.getItem("activeCode"),
        correctAnswers: cheated ? 0 : score,
        totalQuestions: quizQuestions.length,
        percentage:     cheated ? 0 : percentage,
        status:         cheated ? "FAIL" : (percentage >= 40 ? "PASS" : "FAIL"),
        tabSwitched:    cheated
    };

    localStorage.setItem("quizResult", JSON.stringify(resultData));

    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${SERVER_URL}/api/save-result`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(resultData)
        });
        
        const data = await response.json();
        console.log(data.message); // "Result synced to Cloud Atlas!"
    } catch (e) {
        console.error("Cloud Sync Failed:", e);
    }

    window.location.href = "result.html";
}