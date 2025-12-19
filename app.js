// --- State Management ---
const AppState = {
    habits: [],
    user: {
        xp: 0,
        level: 1
    },
    filter: 'all'
};

const XP_PER_LEVEL = 100;
const XP_PER_HABIT = 10;
const LEVEL_TITLES = [
    "Pemula", "Murid", "Petualang", "Pejuang", "Ahli", "Master", "Grandmaster", "Legenda"
];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTheme();
    setupEventListeners();
    renderApp();
    updateDailyWisdom();
    lucide.createIcons();
});

// --- Data Persistence ---
function loadData() {
    const savedHabits = localStorage.getItem('habitforge_habits');
    const savedUser = localStorage.getItem('habitforge_user');

    if (savedHabits) AppState.habits = JSON.parse(savedHabits);
    if (savedUser) AppState.user = JSON.parse(savedUser);
}

function saveData() {
    localStorage.setItem('habitforge_habits', JSON.stringify(AppState.habits));
    localStorage.setItem('habitforge_user', JSON.stringify(AppState.user));
    renderStats(); // Update stats whenever data changes
}

// --- Logic ---
function addHabit(name, category, target) {
    const newHabit = {
        id: Date.now().toString(),
        name,
        category,
        target,
        completedDates: [],
        createdAt: new Date().toISOString()
    };

    AppState.habits.push(newHabit);
    saveData();
    renderHabits();
    showToast('Habit baru berhasil dibuat!', 'success');
}

function toggleHabit(id) {
    const habit = AppState.habits.find(h => h.id === id);
    if (!habit) return;

    const today = new Date().toISOString().split('T')[0];
    const index = habit.completedDates.indexOf(today);

    let isCompleted = false;

    if (index === -1) {
        // Complete habit
        habit.completedDates.push(today);
        addXP(XP_PER_HABIT);
        isCompleted = true;
        triggerConfetti();
        showToast('Hebat! Habit selesai.', 'xp');
    } else {
        // Un-complete habit
        habit.completedDates.splice(index, 1);
        removeXP(XP_PER_HABIT);
        isCompleted = false;
    }

    saveData();
    renderHabits(); // Re-render to update UI state
}

function deleteHabit(id) {
    if (confirm('Yakin ingin menghapus habit ini?')) {
        AppState.habits = AppState.habits.filter(h => h.id !== id);
        saveData();
        renderHabits();
        showToast('Habit dihapus.');
    }
}

function addXP(amount) {
    let oldLevel = AppState.user.level;
    AppState.user.xp += amount;

    // Level Up Logic
    const nextLevelXP = AppState.user.level * XP_PER_LEVEL;
    if (AppState.user.xp >= nextLevelXP) {
        AppState.user.level++;
        AppState.user.xp -= nextLevelXP; // Reset XP for next level or carry over? Usually nicer to just keep growing total or reset. Let's do simple threshold.
        // Actually, simple RPG style: XP accumulates, level based on total? 
        // Let's stick to: XP resets per level to fill the bar easily.
        showToast(`Level Up! Selamat datang di Level ${AppState.user.level}`, 'levelup');
    }

    saveData();
}

function removeXP(amount) {
    if (AppState.user.xp >= amount) {
        AppState.user.xp -= amount;
    } else {
        // De-level logic if we want to be harsh, but let's just floor at current level 0
        AppState.user.xp = 0;
    }
    saveData();
}

// --- Stats Logic ---
function calculateStreak() {
    // Simple streak: if any habit completed today or yesterday, streak continues? 
    // Or global streak? Let's do global "active days streak".
    // A simplified version: check all habits, find distinct dates where ANY habit was done.

    const allDates = new Set();
    AppState.habits.forEach(h => {
        h.completedDates.forEach(d => allDates.add(d));
    });

    const sortedDates = Array.from(allDates).sort().reverse(); // Newest first
    if (sortedDates.length === 0) return 0;

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // If today is completed, start from today. If not, start from yesterday.
    // If neither, streak is broken (0), unless user has no habits yet.

    let currentDate = sortedDates[0];

    if (currentDate !== today && currentDate !== yesterday) {
        return 0; // Streak broken
    }

    // Count backward
    let checkDate = new Date(currentDate);

    // This is a naive approximation for "Global Streak"
    // Ideally calculate consecutive days in sortedDates

    // Let's implement true consecutive check
    let currentStreak = 1;
    let lastDate = new Date(sortedDates[0]);

    for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i]);
        const diffTime = Math.abs(lastDate - prevDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            currentStreak++;
            lastDate = prevDate;
        } else {
            break;
        }
    }

    return currentStreak;
}

function calculateWeeklyProgress() {
    const today = new Date();
    // Get start of week (Monday)
    const day = today.getDay();
    const diff = today.getDate() - day + (day == 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff)).toISOString().split('T')[0];

    // Count total completions since Monday
    let completions = 0;
    AppState.habits.forEach(h => {
        h.completedDates.forEach(d => {
            if (d >= monday) completions++;
        });
    });

    // Ideal: habits * 7 ? Or just relative to "habits * days_passed"?
    // Let's just show raw count or a simple % of "Habits * Days in Week so far"
    const daysPassed = (new Date().getDay() + 6) % 7 + 1;
    const totalPossible = AppState.habits.length * daysPassed;

    if (totalPossible === 0) return 0;
    return Math.round((completions / totalPossible) * 100);
}

// --- DOM Manipulation ---
function renderApp() {
    renderStats();
    renderHabits();
}

function renderStats() {
    // XP
    const xpNeeded = AppState.user.level * XP_PER_LEVEL;
    const xpPercent = (AppState.user.xp / xpNeeded) * 100;

    document.getElementById('user-level').textContent = AppState.user.level;
    const mobileLevel = document.getElementById('mobile-user-level');
    if (mobileLevel) mobileLevel.textContent = AppState.user.level;

    document.getElementById('user-xp').textContent = AppState.user.xp;
    document.getElementById('xp-needed').textContent = xpNeeded;
    document.getElementById('xp-bar-fill').style.width = `${xpPercent}%`;
    document.getElementById('total-xp-display').textContent = (AppState.user.level - 1) * 100 + AppState.user.xp; // Total accumulated approximation

    const titleIndex = Math.min(AppState.user.level - 1, LEVEL_TITLES.length - 1);
    document.getElementById('level-title').textContent = LEVEL_TITLES[titleIndex];

    // Counters
    document.getElementById('streak-count').textContent = calculateStreak();

    // Count today's completed
    const today = new Date().toISOString().split('T')[0];
    const completedToday = AppState.habits.filter(h => h.completedDates.includes(today)).length;
    document.getElementById('completed-count').textContent = completedToday;

    // Weekly
    document.getElementById('weekly-progress').textContent = `${calculateWeeklyProgress()}%`;

    // Badge
    document.getElementById('habit-count-badge').textContent = AppState.habits.length;
}

function renderHabits() {
    const container = document.getElementById('habits-container');
    const emptyState = document.getElementById('empty-state');
    const today = new Date().toISOString().split('T')[0];

    // Filter
    let habitsToRender = AppState.habits;
    if (AppState.filter !== 'all') {
        habitsToRender = habitsToRender.filter(h => h.category === AppState.filter);
    }

    container.innerHTML = '';

    if (habitsToRender.length === 0) {
        container.appendChild(emptyState);
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');

        habitsToRender.forEach(habit => {
            const isCompleted = habit.completedDates.includes(today);

            // Streak for this specific habit
            const habitStreak = calculateHabitStreak(habit);

            const card = document.createElement('div');
            card.className = `group bg-white dark:bg-dark-800 p-4 rounded-2xl border transition-all duration-300 hover:shadow-md animate-slide-up ${isCompleted ? 'border-green-500/30 dark:border-green-500/20 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800'}`;

            card.innerHTML = `
                <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-4 flex-1">
                        <button onclick="toggleHabit('${habit.id}')" class="relative flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-green-500 border-green-500 text-white animate-check' : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-transparent'}">
                            <i data-lucide="check" class="w-5 h-5"></i>
                        </button>
                        
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-gray-900 dark:text-white truncate ${isCompleted ? 'line-through text-gray-500 dark:text-gray-500' : ''}">${habit.name}</h4>
                            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                <span class="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">${habit.category}</span>
                                ${habit.target ? `<span>&bull; Target: ${habit.target}</span>` : ''}
                                <span class="flex items-center gap-1 text-orange-500 dark:text-orange-400">
                                    <i data-lucide="flame" class="w-3 h-3"></i> ${habitStreak}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="deleteHabit('${habit.id}')" class="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;

            container.appendChild(card);
        });

        lucide.createIcons();
    }
}

function calculateHabitStreak(habit) {
    const dates = habit.completedDates.sort().reverse();
    if (dates.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 0;
    // ... Simplified logic for now, similar to global streak logic but per habit
    // Ideally use moment.js or date-fns, but vanilla is fine:
    let current = new Date(dates[0]);
    streak = 1;

    for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i]);
        const diff = Math.floor((current - prev) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
            streak++;
            current = prev;
        } else {
            break;
        }
    }
    return streak;
}


// --- Event Listeners ---
function setupEventListeners() {
    // Modal
    const modal = document.getElementById('add-modal');
    const modalPanel = document.getElementById('add-modal-panel');
    const backdrop = document.getElementById('add-modal-backdrop');

    function openModal() {
        modal.classList.remove('hidden');
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            modalPanel.classList.remove('opacity-0', 'scale-95');
            modalPanel.classList.add('scale-100');
        }, 10);
    }

    function closeModal() {
        backdrop.classList.add('opacity-0');
        modalPanel.classList.remove('scale-100');
        modalPanel.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    document.getElementById('btn-add-habit').addEventListener('click', openModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    // Form
    document.getElementById('add-habit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('habit-name').value;
        const target = document.getElementById('habit-target').value;
        const category = document.querySelector('input[name="category"]:checked').value;

        addHabit(name, category, target);

        // Reset and close
        e.target.reset();
        closeModal();
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // UI Update
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'bg-primary-600', 'text-white'));
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.add('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-800'));

            // Active State
            e.target.classList.remove('text-gray-600', 'hover:bg-gray-100', 'dark:text-gray-300', 'dark:hover:bg-gray-800'); // Remove Base
            e.target.classList.add('active', 'bg-primary-600', 'text-white');

            AppState.filter = e.target.dataset.category;
            renderHabits();
        });
    });

    // Initial Filter Style
    const activeFilter = document.querySelector(`.filter-btn[data-category="all"]`);
    if (activeFilter) {
        activeFilter.classList.add('bg-primary-600', 'text-white');
        activeFilter.classList.remove('text-gray-600', 'hover:bg-gray-100');
    }

    // Daily Wisdom Rotation
    document.getElementById('next-wisdom-btn').addEventListener('click', updateDailyWisdom);
}

// --- Helper Functions ---
function updateDailyWisdom() {
    const tip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
    document.getElementById('wisdom-title').textContent = tip.title;
    document.getElementById('wisdom-content').textContent = tip.content;
    document.querySelector('.uppercase').textContent = tip.category; // Tag
}

function initTheme() {
    // Check local storage or system preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
}

function showToast(message, type = 'normal') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    const xpEl = document.getElementById('toast-xp');

    msgEl.textContent = message;

    if (type === 'xp') {
        xpEl.classList.remove('hidden');
    } else {
        xpEl.classList.add('hidden');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

function triggerConfetti() {
    const end = Date.now() + 1000;
    const colors = ['#0ea5e9', '#6366f1'];

    (function frame() {
        showConfetti(colors);
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

function showConfetti(colors) {
    confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
    });
    confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
    });
}
