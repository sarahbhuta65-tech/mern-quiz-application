const SERVER_URL = "http://localhost:8000";

if (sessionStorage.getItem("isInstructor") !== "true") {
    window.location.href = "teacher-login.html";
}

const teacherName = localStorage.getItem("teacherName") || "Instructor";
const authHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${localStorage.getItem("teacherToken")}`
});

document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("teacherNameDisplay");
    if (el) el.innerText = teacherName;
});

function showSection(sectionId) {
    document.querySelectorAll('.content-block').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById(sectionId + 'Section').style.display = 'block';
    document.getElementById('nav-' + sectionId).classList.add('active');
    if (sectionId === 'stats')   refreshStats();
    if (sectionId === 'bank')    loadInventory();
    if (sectionId === 'reports') loadReports();
}

async function refreshStats() {
    try {
        const [resultsRes, quizzesRes] = await Promise.all([
            fetch(`${SERVER_URL}/getResults`, { headers: authHeaders() }),
            fetch(`${SERVER_URL}/api/quiz`,   { headers: authHeaders() })
        ]);
        const data    = await resultsRes.json();
        const quizzes = await quizzesRes.json();
        document.getElementById('totalAttempts').innerText = Array.isArray(data)    ? data.length    : 0;
        document.getElementById('totalQuizzes').innerText  = Array.isArray(quizzes) ? quizzes.length : 0;
        if (Array.isArray(data)) {
            const top5 = [...data].sort((a,b) => b.percentage - a.percentage).slice(0,5);
            document.getElementById('leaderboardList').innerHTML = top5.length
                ? top5.map(p => `<li>${p.studentName} <span>${p.percentage}%</span></li>`).join('')
                : "<li style='color:#64748b'>No attempts yet</li>";
            renderChart(data);
        }
    } catch(e) { console.error("Stats Error:", e); }
}

async function loadReports() {
    const tableBody = document.getElementById("reportsTableBody");
    if (!tableBody) return;
    try {
        const res = await fetch(`${SERVER_URL}/getResults`, { headers: authHeaders() });
        const allReports = await res.json();
        window._allReports = Array.isArray(allReports) ? allReports : [];
        renderReportsTable(window._allReports);
    } catch {
        tableBody.innerHTML = "<tr><td colspan='5' style='color:red;'>Connection Error</td></tr>";
    }
}

function renderReportsTable(data) {
    const tableBody = document.getElementById("reportsTableBody");
    if (!tableBody) return;
    if (!data.length) {
        tableBody.innerHTML = "<tr><td colspan='5' style='color:#64748b; text-align:center; padding:24px;'>No records found.</td></tr>";
        return;
    }
    tableBody.innerHTML = data.map(r => `
        <tr>
            <td>${r.studentName}</td>
            <td><b style="color:#a78bfa">${r.quizCode}</b></td>
            <td>${r.correctAnswers}/${r.totalQuestions}</td>
            <td style="color:${r.status==='PASS'?'#10b981':'#ef4444'}">${r.percentage}% — <b>${r.status}</b></td>
            <td>${r.tabSwitched ? '⚠️ FLAGGED' : '✅ SECURE'}</td>
        </tr>`).join('');
}

function filterReports() {
    const q = document.getElementById("reportSearch").value.toLowerCase();
    if (!window._allReports) return;
    renderReportsTable(window._allReports.filter(r =>
        r.studentName.toLowerCase().includes(q) || r.quizCode.toLowerCase().includes(q)
    ));
}

function downloadReportsCSV() {
    const data = window._allReports;
    if (!data?.length) return alert("No data to download.");
    const headers = ["Student","Quiz Code","Score","Total","Percentage","Status","Integrity","Date"];
    const rows = data.map(r => [r.studentName, r.quizCode, r.correctAnswers, r.totalQuestions, r.percentage+"%", r.status, r.tabSwitched?"FLAGGED":"SECURE", r.date||""]);
    const csv = [headers,...rows].map(row => row.map(v=>`"${v}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
    link.download = `reports_${teacherName}_${new Date().toLocaleDateString()}.csv`;
    link.click();
}

async function loadInventory() {
    const listContainer = document.getElementById("quizInventoryList");
    listContainer.innerHTML = "<p style='color:#64748b;'>Loading...</p>";
    try {
        const res     = await fetch(`${SERVER_URL}/api/quiz`, { headers: authHeaders() });
        const quizzes = await res.json();
        if (!quizzes.length) {
            listContainer.innerHTML = "<p style='color:#64748b;'>No quizzes yet. Create one!</p>";
            return;
        }
        listContainer.innerHTML = "";
        quizzes.forEach(quiz => {
            const card = document.createElement("div");
            card.className = "stat-card";
            card.style.justifyContent = "space-between";
            card.innerHTML = `
                <div>
                    <h4 style="color:#a78bfa; margin-bottom:4px;">${quiz.code}</h4>
                    <p style="color:#64748b; font-size:0.82rem;">${quiz.questions.length} Questions</p>
                    <p style="color:#64748b; font-size:0.75rem; margin-top:4px;">${new Date(quiz.createdAt).toLocaleDateString()}</p>
                </div>
                <button class="primary-btn" onclick="deleteQuiz('${quiz.code}')" style="background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.25); padding:8px 14px;">
                    <i class="fas fa-trash"></i>
                </button>`;
            listContainer.appendChild(card);
        });
    } catch {
        listContainer.innerHTML = "<p style='color:red;'>Failed to load quizzes.</p>";
    }
}

async function deleteQuiz(code) {
    if (!confirm(`Delete quiz "${code}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${SERVER_URL}/api/quiz/${code}`, { method:"DELETE", headers: authHeaders() });
        const data = await res.json();
        res.ok ? loadInventory() : alert(data.error);
    } catch { alert("Failed to delete quiz."); }
}

async function saveCompleteQuiz() {
    const code = document.getElementById("quizCodeInput").value.trim();
    if (!code) return alert("Enter a Quiz Code!");
    const questions = [];
    document.querySelectorAll(".question-card").forEach(card => {
        questions.push({
            question: card.querySelector(".q-text").value.trim(),
            options: { A: card.querySelector(".opt-a").value.trim(), B: card.querySelector(".opt-b").value.trim(), C: card.querySelector(".opt-c").value.trim(), D: card.querySelector(".opt-d").value.trim() },
            correctAnswer: card.querySelector(".correct-ans").value.toUpperCase()
        });
    });
    if (!questions.length) return alert("Add at least one question!");
    try {
        const res  = await fetch(`${SERVER_URL}/api/quiz`, { method:"POST", headers: authHeaders(), body: JSON.stringify({ code, questions }) });
        const data = await res.json();
        if (res.ok) {
            alert(`✅ Quiz "${code}" published!`);
            document.getElementById("quizCodeInput").value = "";
            document.getElementById("questionContainer").innerHTML = "";
            questionCount = 0;
        } else { alert(data.error); }
    } catch { alert("Failed to publish quiz."); }
}

let questionCount = 0;

function addNewQuestionField() {
    questionCount++;
    const container = document.getElementById("questionContainer");
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
        <div class="q-header">
            <span>Question ${questionCount}</span>
            <button type="button" class="remove-btn" onclick="this.closest('.question-card').remove()">✕ Remove</button>
        </div>
        <input type="text" class="q-text" placeholder="Enter your question here...">
        <div class="options-grid">
            <input type="text" class="opt-a" placeholder="Option A">
            <input type="text" class="opt-b" placeholder="Option B">
            <input type="text" class="opt-c" placeholder="Option C">
            <input type="text" class="opt-d" placeholder="Option D">
        </div>
        <select class="correct-ans">
            <option value="">-- Select Correct Answer --</option>
            <option value="A">A</option><option value="B">B</option>
            <option value="C">C</option><option value="D">D</option>
        </select>`;
    container.appendChild(card);
}

async function generateAIQuiz() {
    const apiKey = document.getElementById("geminiKey").value.trim();
    const topic  = document.getElementById("aiTopic").value.trim();
    const code   = document.getElementById("aiQuizCode").value.trim();
    const count  = parseInt(document.getElementById("aiCount").value) || 5;
    const statusEl  = document.getElementById("aiStatus");
    const previewEl = document.getElementById("aiPreview");
    if (!apiKey) return alert("Enter your Groq API key.");
    if (!topic)  return alert("Enter a topic.");
    if (!code)   return alert("Enter a quiz code.");
    document.getElementById("aiBtn").disabled = true;
    statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating ${count} questions on "${topic}"...`;
    previewEl.innerHTML = "";
    const prompt = `Generate exactly ${count} multiple choice quiz questions about "${topic}". Return ONLY a valid JSON array, no explanation, no markdown. Format: [{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"A"}]`;
    try {
        const res  = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
            body: JSON.stringify({ model:"llama3-8b-8192", messages:[{role:"user",content:prompt}], temperature:0.7 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "API error");
        let raw = data.choices[0].message.content.trim().replace(/```json|```/g,"").trim();
        const questions = JSON.parse(raw);
        const saveRes = await fetch(`${SERVER_URL}/api/quiz`, { method:"POST", headers: authHeaders(), body: JSON.stringify({ code, questions }) });
        const saveData = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveData.error);
        statusEl.innerHTML = `<span style="color:#10b981;">✅ ${questions.length} questions saved as <b>${code}</b>!</span>`;
        previewEl.innerHTML = questions.map((q,i) => `
            <div class="question-card" style="margin-top:12px;">
                <div class="q-header"><span>Q${i+1}: ${q.question}</span></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    ${["A","B","C","D"].map(k=>`<div style="padding:8px 12px;border-radius:8px;font-size:0.85rem;background:${q.correctAnswer===k?'rgba(16,185,129,0.1)':'rgba(255,255,255,0.04)'};border:1px solid ${q.correctAnswer===k?'#10b981':'rgba(255,255,255,0.06)'};color:${q.correctAnswer===k?'#10b981':'#94a3b8'}"><b>${k}:</b> ${q.options[k]}</div>`).join("")}
                </div>
            </div>`).join("");
    } catch(e) {
        statusEl.innerHTML = `<span style="color:#ef4444;">❌ Error: ${e.message}</span>`;
    } finally {
        document.getElementById("aiBtn").disabled = false;
    }
}

function renderChart(data) {
    const canvas = document.getElementById("performanceChart");
    if (!canvas) return;
    if (window.perfChart) window.perfChart.destroy();
    const last10 = data.slice(0,10).reverse();
    window.perfChart = new Chart(canvas.getContext("2d"), {
        type:"line",
        data:{ labels: last10.map(r=>r.studentName), datasets:[{ label:"Score %", data: last10.map(r=>r.percentage), borderColor:"#8b5cf6", backgroundColor:"rgba(139,92,246,0.08)", borderWidth:2, pointBackgroundColor:"#06b6d4", fill:true, tension:0.4 }] },
        options:{ responsive:true, scales:{ y:{beginAtZero:true,max:100,ticks:{color:"#64748b"},grid:{color:"rgba(255,255,255,0.04)"}}, x:{ticks:{color:"#64748b"},grid:{display:false}} }, plugins:{legend:{labels:{color:"#94a3b8"}}} }
    });
}

window.onload = refreshStats;
