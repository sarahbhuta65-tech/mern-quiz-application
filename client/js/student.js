/**
 * Smart Quiz System - Student Dashboard Controller
 */

const SERVER_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Authentication Check: Ensure a student is logged in
    const studentName = localStorage.getItem("studentName");
    if (!studentName) {
        // Redirect to login if no session is found
        window.location.href = "login1.html";
        return;
    }

    // Display the logged-in student's name in the UI
    const nameDisplay = document.getElementById("displayStudentName");
    if (nameDisplay) nameDisplay.innerText = studentName;

    // 2. Initial Data Load
    loadStudentData();
});

/**
 * SECTION NAVIGATION
 * Switches views between Overview (Charts) and History (Table)
 */
function showStudentSection(sectionId) {
    document.querySelectorAll('.content-block').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));

    const target = document.getElementById(sectionId + 'Section');
    if (target) target.classList.add('active');

    const navItem = document.getElementById('nav-' + sectionId);
    if (navItem) navItem.classList.add('active');

    if (sectionId === 'overview') loadStudentData();
}

/**
 * DATA ENGINE
 * Pulls, filters, and displays the student's specific quiz records from the backend
 */
async function loadStudentData() {
    const studentName = localStorage.getItem("studentName");
    const token = localStorage.getItem("authToken");

    let myData = [];

    try {
        const res = await fetch(`${SERVER_URL}/api/my-results`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("my-results status:", res.status);
        if (res.ok) {
            myData = await res.json();
            console.log("my-results data:", myData);
        } else {
            const err = await res.json();
            console.error("my-results error:", err);
        }
    } catch (e) {
        console.error("Failed to load results from server:", e);
    }

    // --- UPDATE STATS CARDS ---
    const totalEl = document.getElementById("myTotalQuizzes");
    const avgEl = document.getElementById("myAvgScore");

    if (totalEl) totalEl.innerText = myData.length;
    
    if (avgEl) {
        const avg = myData.length 
            ? Math.round(myData.reduce((acc, curr) => acc + curr.percentage, 0) / myData.length) 
            : 0;
        avgEl.innerText = avg + "%";
    }

    // --- UPDATE HISTORY TABLE ---
    const tableBody = document.getElementById("studentHistoryTable");
    if (tableBody) {
        tableBody.innerHTML = myData.length ? "" : "<tr><td colspan='5'>No quiz attempts found.</td></tr>";
        
        // Show newest attempts first
        [...myData].reverse().forEach(r => {
            tableBody.innerHTML += `
                <tr>
                    <td>${r.quizCode}</td>
                    <td>${r.date || 'N/A'}</td>
                    <td>${r.correctAnswers}/${r.totalQuestions} (${r.percentage}%)</td>
                    <td class="${r.status === 'PASS' ? 'pass-text' : 'fail-text'}">${r.status}</td>
                    <td class="${r.tabSwitched ? 'violation' : 'secure'}">
                        ${r.tabSwitched ? '⚠️ Flagged' : '✅ Secure'}
                    </td>
                </tr>`;
        });
    }

    // --- UPDATE PROGRESS CHART ---
    renderProgressChart(myData);
}

/**
 * CHART RENDERING
 * Visualizes performance trends using Chart.js
 */
function renderProgressChart(myData) {
    const canvas = document.getElementById('studentProgressChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart instance to prevent flickering/overlap
    if (window.progChart) window.progChart.destroy();

    window.progChart = new Chart(ctx, {
        type: 'line',
        data: {
            // Use Quiz Codes or Dates as labels
            labels: myData.map(r => r.quizCode), 
            datasets: [{
                label: 'My Performance (%)',
                data: myData.map(r => r.percentage),
                borderColor: '#00eaff',
                backgroundColor: 'rgba(0, 234, 255, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#00ffa3',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { 
                    beginAtZero: true, 
                    max: 100, 
                    ticks: { color: '#8ba1ad' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: { 
                    ticks: { color: '#8ba1ad' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

/**
 * LOGOUT SESSION
 */
function logoutStudent() {
    // Clear session but keep localStorage users for future logins
    sessionStorage.removeItem("userLoggedIn");
    window.location.href = "login1.html";
}