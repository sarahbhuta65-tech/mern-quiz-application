const SERVER_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", async () => {
    const rawData = localStorage.getItem("quizResult");

    if (!rawData) {
        window.location.href = "index.html";
        return;
    }

    const resultData = JSON.parse(rawData);

    document.getElementById("resName").innerText = resultData.studentName;
    document.getElementById("resTotal").innerText = resultData.totalQuestions;
    document.getElementById("resCorrect").innerText = resultData.correctAnswers;
    document.getElementById("resPercent").innerText = resultData.percentage + "%";

    const statusEl = document.getElementById("status");

    if (resultData.tabSwitched) {
        statusEl.innerText = "DISQUALIFIED";
        statusEl.className = "status-pill status-dq";
        document.getElementById("securityNote").style.display = "block";
        if (document.getElementById("passActions")) {
            document.getElementById("passActions").style.display = "none";
        }
    } else {
        statusEl.innerText = resultData.status;
        statusEl.className = `status-pill ${resultData.status === "PASS" ? "status-pass" : "status-fail"}`;
        if (resultData.status === "PASS" && document.getElementById("passActions")) {
            document.getElementById("passActions").style.display = "block";
        }
    }

    // Animate score ring
    const circumference = 439.8;
    const offset = circumference - (resultData.percentage / 100) * circumference;
    setTimeout(() => {
        const ring = document.getElementById("ringFill");
        if (ring) ring.style.strokeDashoffset = offset;
    }, 200);

    // Load history and leaderboard from backend
    await loadStudentHistory(resultData.studentName);
    await loadLeaderboard(resultData.quizCode);
});

async function loadStudentHistory(currentStudent) {
    const historyDiv = document.getElementById("studentHistoryList");
    if (!historyDiv) return;

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${SERVER_URL}/api/my-results`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const myQuizzes = await res.json();

        if (!myQuizzes.length) {
            historyDiv.innerHTML = "<p style='color: #8ba1ad;'>No previous records found.</p>";
            return;
        }

        historyDiv.innerHTML = myQuizzes.map(q => `
            <div class="history-item ${q.status === 'PASS' ? 'pass' : 'fail'}">
                <div>
                    <div class="code">${q.quizCode || 'Quiz'}</div>
                    <div class="date">${q.date || ''}</div>
                </div>
                <span class="pct" style="color:${q.status === 'PASS' ? 'var(--pass)' : 'var(--fail)'}">
                    ${q.percentage}% ${q.tabSwitched ? '⚠️' : ''}
                </span>
            </div>
        `).join('');
    } catch (e) {
        historyDiv.innerHTML = "<p style='color:#ff5c5c;'>Could not load history.</p>";
    }
}

async function loadLeaderboard(currentQuizCode) {
    const leaderboardDiv = document.getElementById("leaderboardList");
    if (!leaderboardDiv || !currentQuizCode) return;

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${SERVER_URL}/api/leaderboard/${currentQuizCode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const top5 = await res.json();

        if (!top5.length) {
            leaderboardDiv.innerHTML = "<p style='color: #8ba1ad;'>No competitive data available yet.</p>";
            return;
        }

        leaderboardDiv.innerHTML = top5.map((q, index) => {
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
            return `
                <div class="lb-item ${index === 0 ? 'gold' : ''}">
                    <span class="lb-medal">${medal}</span>
                    <span class="lb-name">${q.studentName}</span>
                    <span class="lb-score">${q.percentage}%</span>
                </div>
            `;
        }).join('');
    } catch (e) {
        leaderboardDiv.innerHTML = "<p style='color:#ff5c5c;'>Could not load leaderboard.</p>";
    }
}

function generateCertificate() {
    const canvas = document.getElementById("certCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const data = JSON.parse(localStorage.getItem("quizResult"));

    ctx.fillStyle = "#162630";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = "#00eaff";
    ctx.lineWidth = 20;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    
    ctx.font = "30px 'Segoe UI'";
    ctx.fillText("CERTIFICATE OF COMPLETION", canvas.width / 2, 150);

    ctx.font = "20px 'Segoe UI'";
    ctx.fillStyle = "#8ba1ad";
    ctx.fillText("This is to certify that", canvas.width / 2, 220);

    ctx.font = "bold 50px 'Segoe UI'";
    ctx.fillStyle = "#00eaff";
    ctx.fillText(data.studentName.toUpperCase(), canvas.width / 2, 300);

    ctx.font = "20px 'Segoe UI'";
    ctx.fillStyle = "#8ba1ad";
    ctx.fillText(`has successfully passed the assessment for`, canvas.width / 2, 370);

    ctx.font = "bold 30px 'Segoe UI'";
    ctx.fillStyle = "white";
    ctx.fillText(`Quiz Code: ${data.quizCode}`, canvas.width / 2, 420);

    ctx.font = "bold 40px 'Segoe UI'";
    ctx.fillStyle = "#00ffa3";
    ctx.fillText(`SCORE: ${data.percentage}%`, canvas.width / 2, 500);

    const link = document.createElement('a');
    link.download = `${data.studentName}_Certificate.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}