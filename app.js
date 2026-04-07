/**
 * PWA Ежедневник - Основной файл приложения
 * Адаптирован для работы с PHP версией index.php
 */

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let notes = [];
let currentFilter = 'all';
let deferredPrompt;

// Получение конфигурации из PHP (передаётся через index.php)
const PHP_CONFIG = window.PHP_CONFIG || {
    basePath: '',
    currentFilter: 'all',
    isHttps: false,
    host: window.location.host,
    today: new Date().toISOString().split('T')[0]
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Получение правильного пути к ресурсам с учётом basePath из PHP
 */
function getResourcePath(path) {
    // Убираем лишние слеши
    const base = PHP_CONFIG.basePath.replace(/\/$/, '');
    const resourcePath = path.replace(/^\//, '');
    
    if (base && resourcePath) {
        return base + '/' + resourcePath;
    }
    return resourcePath || base;
}

/**
 * Экранирование HTML для защиты от XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Форматирование даты для отображения
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Дата не указана';
    
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Сброс времени для корректного сравнения
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) {
        return 'Сегодня';
    } else if (date.getTime() === tomorrow.getTime()) {
        return 'Завтра';
    } else {
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
}

/**
 * Обновление счётчика заметок
 */
function updateTotalCount() {
    const totalCountEl = document.getElementById('totalCount');
    if (totalCountEl) {
        totalCountEl.textContent = notes.length;
    }
}

// ==================== РАБОТА С ХРАНИЛИЩЕМ (LOCALSTORAGE) ====================

/**
 * Загрузка заметок из localStorage
 */
function loadNotes() {
    try {
        const stored = localStorage.getItem('daily_notes');
        if (stored) {
            notes = JSON.parse(stored);
            console.log(`📥 Загружено ${notes.length} заметок из localStorage`);
        } else {
            notes = [];
            console.log('📭 Нет сохранённых заметок');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки из localStorage:', error);
        notes = [];
    }
    renderNotes();
}

/**
 * Сохранение заметок в localStorage
 */
function saveNotes() {
    try {
        localStorage.setItem('daily_notes', JSON.stringify(notes));
        updateTotalCount();
        console.log(`💾 Сохранено ${notes.length} заметок в localStorage`);
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения в localStorage:', error);
        return false;
    }
}

// ==================== УВЕДОМЛЕНИЯ ====================

/**
 * Показ системного уведомления
 */
function showNotification(title, body) {
    if (!('Notification' in window)) {
        console.log('⚠️ Браузер не поддерживает уведомления');
        return;
    }
    
    if (Notification.permission === 'granted') {
        const options = {
            body: body,
            icon: getResourcePath('/icons/icon-192x192.png'),
            badge: getResourcePath('/icons/icon-72x72.png'),
            vibrate: [200, 100, 200],
            silent: false
        };
        
        const notification = new Notification(title, options);
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
        
        setTimeout(() => notification.close(), 5000);
    }
}

/**
 * Локальное уведомление о новой заметке
 */
function sendLocalNotification(title, body) {
    showNotification(title, body);
}

/**
 * Проверка заметок на сегодня и отправка уведомлений
 */
function checkTodayNotes() {
    const today = PHP_CONFIG.today;
    const todayNotes = notes.filter(note => note.date === today);
    
    if (todayNotes.length > 0 && Notification.permission === 'granted') {
        const message = todayNotes.length === 1 
            ? `📝 "${todayNotes[0].text.substring(0, 40)}${todayNotes[0].text.length > 40 ? '...' : ''}"`
            : `📋 ${todayNotes.length} заметки на сегодня`;
        
        showNotification(
            '📅 Напоминание на сегодня',
            message
        );
    }
}

/**
 * Запрос разрешения на уведомления
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('❌ Ваш браузер не поддерживает уведомления');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        alert('✅ Уведомления уже разрешены');
        checkTodayNotes();
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            alert('✅ Уведомления разрешены!');
            showNotification('Добро пожаловать!', 'Уведомления успешно настроены');
            checkTodayNotes();
            return true;
        } else {
            alert('⚠️ Уведомления не разрешены');
            return false;
        }
    }
    
    alert('❌ Уведомления заблокированы браузером');
    return false;
}

// ==================== РАБОТА С ЗАМЕТКАМИ ====================

/**
 * Добавление новой заметки
 */
function addNote() {
    const textInput = document.getElementById('noteText');
    const dateInput = document.getElementById('noteDate');
    
    const text = textInput ? textInput.value.trim() : '';
    const date = dateInput ? dateInput.value : '';
    
    if (!text) {
        alert('❌ Введите текст заметки');
        if (textInput) textInput.focus();
        return;
    }
    
    if (!date) {
        alert('❌ Выберите дату');
        return;
    }
    
    if (text.length > 200) {
        alert('❌ Текст не должен превышать 200 символов');
        return;
    }
    
    const newNote = {
        id: Date.now(),
        text: text,
        date: date,
        createdAt: new Date().toISOString()
    };
    
    notes.push(newNote);
    saveNotes();
    renderNotes();
    
    // Очистка поля текста
    if (textInput) textInput.value = '';
    
    // Уведомление о добавлении
    alert('✅ Заметка добавлена!');
    
    // Если заметка на сегодня - отправляем уведомление
    if (date === PHP_CONFIG.today) {
        sendLocalNotification('📝 Новая заметка на сегодня', text.substring(0, 50));
    }
}

/**
 * Удаление заметки
 */
function deleteNote(id) {
    if (confirm('🗑️ Удалить эту заметку?')) {
        notes = notes.filter(note => note.id !== id);
        saveNotes();
        renderNotes();
        alert('✅ Заметка удалена');
    }
}

// ==================== ФИЛЬТРАЦИЯ И ОТОБРАЖЕНИЕ ====================

/**
 * Фильтрация заметок по выбранному фильтру
 */
function filterNotes() {
    const today = PHP_CONFIG.today;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    let filtered = [...notes];
    
    switch(currentFilter) {
        case 'today':
            filtered = notes.filter(note => note.date === today);
            break;
        case 'week':
            filtered = notes.filter(note => note.date >= weekAgoStr);
            break;
        case 'all':
        default:
            filtered = notes;
            break;
    }
    
    // Сортировка по дате (новые сверху)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return filtered;
}

/**
 * Отображение заметок в DOM
 */
function renderNotes() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    
    const filtered = filterNotes();
    
    if (filtered.length === 0) {
        notesList.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <div class="empty-text">Нет заметок</div>
                <div class="empty-hint">Добавьте свою первую заметку</div>
            </div>
        `;
        updateTotalCount();
        return;
    }
    
    notesList.innerHTML = filtered.map(note => `
        <div class="note-item" data-id="${note.id}">
            <div class="note-content">
                <div class="note-text">${escapeHtml(note.text)}</div>
                <div class="note-date">📅 ${formatDate(note.date)}</div>
            </div>
            <button class="delete-btn" onclick="deleteNote(${note.id})" title="Удалить заметку">
                🗑️ Удалить
            </button>
        </div>
    `).join('');
    
    updateTotalCount();
}

/**
 * Установка активного фильтра
 */
function setFilter(filter) {
    currentFilter = filter;
    
    // Обновляем активный класс у кнопок
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Перерисовываем заметки
    renderNotes();
    
    // Сохраняем выбранный фильтр
    localStorage.setItem('daily_notes_filter', filter);
}

// ==================== SERVICE WORKER (PWA) ====================

/**
 * Регистрация Service Worker
 */
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('⚠️ Service Worker не поддерживается');
        return false;
    }
    
    try {
        const swPath = getResourcePath('/sw.js');
        const registration = await navigator.serviceWorker.register(swPath);
        console.log('✅ Service Worker зарегистрирован:', registration.scope);
        
        // Обработка push-уведомлений
        if ('PushManager' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Push-уведомления поддерживаются');
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка регистрации Service Worker:', error);
        return false;
    }
}

// ==================== PWA УСТАНОВКА ====================

/**
 * Настройка установки PWA
 */
function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'flex';
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    console.log('✅ PWA установлена');
                    installBtn.style.display = 'none';
                } else {
                    console.log('❌ Установка отменена');
                }
                
                deferredPrompt = null;
            });
        }
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('🎉 PWA успешно установлена');
    });
}

// ==================== НАСТРОЙКА СОБЫТИЙ ====================

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Добавление заметки
    const addBtn = document.getElementById('addNoteBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addNote);
    }
    
    // Добавление по Enter в поле текста
    const noteText = document.getElementById('noteText');
    if (noteText) {
        noteText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addNote();
            }
        });
    }
    
    // Кнопка разрешения уведомлений
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', requestNotificationPermission);
    }
    
    // Кнопки фильтров
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.dataset.filter);
        });
    });
}

/**
 * Загрузка сохранённого фильтра
 */
function loadSavedFilter() {
    const savedFilter = localStorage.getItem('daily_notes_filter');
    if (savedFilter && ['all', 'today', 'week'].includes(savedFilter)) {
        setFilter(savedFilter);
    } else if (PHP_CONFIG.currentFilter && PHP_CONFIG.currentFilter !== 'all') {
        // Используем фильтр из PHP если он установлен
        setFilter(PHP_CONFIG.currentFilter);
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

/**
 * Основная функция инициализации приложения
 */
async function init() {
    console.log('🚀 Инициализация PWA Ежедневника...');
    console.log('📁 BasePath:', PHP_CONFIG.basePath || '/');
    console.log('🔔 Уведомления:', Notification.permission);
    
    // Загружаем заметки из localStorage
    loadNotes();
    
    // Настраиваем обработчики событий
    setupEventListeners();
    
    // Загружаем сохранённый фильтр
    loadSavedFilter();
    
    // Регистрируем Service Worker
    await registerServiceWorker();
    
    // Настраиваем установку PWA
    setupInstallPrompt();
    
    // Проверяем заметки на сегодня
    setTimeout(() => {
        if (Notification.permission === 'granted') {
            checkTodayNotes();
        }
    }, 2000);
    
    console.log('✅ Приложение готово к работе');
}

// Запуск приложения после полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Экспорт функций в глобальную область видимости для использования в HTML (onclick)
window.deleteNote = deleteNote;
window.addNote = addNote;
window.requestNotificationPermission = requestNotificationPermission;