// cabinet.js — Полный функционал личного кабинета

const API_KEY = 'cb5b3b0c-7518-4730-86c3-79454ef67a44';
const BASE_URL = 'https://api.codetabs.com/v1/proxy?quest=' + 
  encodeURIComponent('http://exam-api-courses.std-900.ist.mospolytech.ru/api');
const ITEMS_PER_PAGE = 5;

let allOrders = [];
let allCourses = [];
let currentPage = 1;
let currentOrder = null;

// Утилиты
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const updateContent = (id, html) => { const el = $(`#${id}`); if (el) el.innerHTML = html; };

const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
};

const formatDate = (dateStr) => {
    try {
        return new Date(dateStr).toLocaleDateString('ru-RU');
    } catch {
        return dateStr;
    }
};

// Показ уведомления
function showNotification(message, type = 'info') {
    const container = $('#notificationArea');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.role = 'alert';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi bi-${type === 'danger' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
                ${escapeHtml(message)}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    container.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// Загрузка данных
async function loadData() {
    try {
        // Параллельная загрузка
        const [ordersRes, coursesRes] = await Promise.all([
            fetch(`${BASE_URL}/orders?api_key=${API_KEY}`),
            fetch(`${BASE_URL}/courses?api_key=${API_KEY}`)
        ]);

        if (!ordersRes.ok) throw new Error(`Ошибка загрузки заказов: ${ordersRes.status}`);
        if (!coursesRes.ok) throw new Error(`Ошибка загрузки курсов: ${coursesRes.status}`);

        allCourses = await coursesRes.json();  // Сохраняем курсы
        allOrders = await ordersRes.json();

        const courseMap = Object.fromEntries(allCourses.map(c => [c.id, c]));

        allOrders.forEach(order => {
            order.course = courseMap[order.course_id];
            order.totalPrice = Math.round(order.price);
        });

        renderOrders();
        populateCourseSelect(); // Заполняем селект
    } catch (error) {
        console.error(error);
        updateContent('ordersTableBody', `
            <tr><td colspan="5" class="text-center text-danger py-3">${escapeHtml(error.message)}</td></tr>
        `);
    }
}

function populateCourseSelect() {
    const select = $('#editCourseId');
    if (!select) return;

    select.innerHTML = allCourses.map(course => `
        <option value="${course.id}">
            ${escapeHtml(course.name)} (${course.course_fee_per_hour} ₽/час)
        </option>
    `).join('');
}


// Рендер таблицы
function renderOrders() {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = allOrders.slice(start, start + ITEMS_PER_PAGE);
    const tbody = $('#ordersTableBody');

    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Нет заказов</td></tr>';
        renderPagination(0);
        return;
    }

    tbody.innerHTML = paginated.map((order, idx) => {
        const num = start + idx + 1;
        return `
            <tr>
                <td><strong>#${order.id || num}</strong></td>
                <td>
                    <strong>${escapeHtml(order.course?.name || 'Курс не найден')}</strong><br>
                    <small class="text-muted">${escapeHtml(order.course?.teacher || '')}</small>
                </td>
                <td>${formatDate(order.date_start)}</td>
                <td><strong class="text-success">${order.totalPrice.toLocaleString('ru-RU')} ₽</strong></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="openDetails(${order.id})"><i class="bi bi-eye"></i></button>
                        <button class="btn btn-outline-warning" onclick="openEdit(${order.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-outline-danger" onclick="openDelete(${order.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination(allOrders.length);
}

// Пагинация
function renderPagination(total) {
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const container = $('#pagination');
    container.innerHTML = '';

    if (pages <= 1) return;

    let html = '';
    if (currentPage > 1) html += `<li class="page-item"><button class="page-link" onclick="goToPage(${currentPage - 1})">←</button></li>`;
    for (let i = 1; i <= pages; i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><button class="page-link" onclick="goToPage(${i})">${i}</button></li>`;
    }
    if (currentPage < pages) html += `<li class="page-item"><button class="page-link" onclick="goToPage(${currentPage + 1})">→</button></li>`;

    container.innerHTML = `<ul class="pagination">${html}</ul>`;
}

function goToPage(page) {
    currentPage = page;
    renderOrders();
}

// Подробнее
function openDetails(id) {
    const order = allOrders.find(o => o.id === id);
    if (!order) return;

    const discounts = [];
    if (order.early_registration) discounts.push('Ранняя запись: -10%');
    if (order.group_enrollment) discounts.push('Группа: -15%');
    if (order.intensive_course) discounts.push('Интенсивный курс: +20%');

    $('#detailsModalBody').innerHTML = `
        <h5><strong>${escapeHtml(order.course?.name)}</strong></h5>
        <p>${escapeHtml(order.course?.description || 'Описание отсутствует')}</p>
        <hr>
        <div class="row g-3">
            <div class="col-6"><strong>Преподаватель:</strong><br>${escapeHtml(order.course?.teacher || '—')}</div>
            <div class="col-6"><strong>Дата начала:</strong><br>${formatDate(order.date_start)}</div>
            <div class="col-6"><strong>Время:</strong><br>${order.time_start || '—'}</div>
            <div class="col-6"><strong>Человек:</strong><br>${order.persons || 1}</div>
            <div class="col-12"><strong>Стоимость:</strong><br><span class="text-success fs-5">${order.totalPrice.toLocaleString('ru-RU')} ₽</span></div>
        </div>
        ${discounts.length ? `
            <hr>
            <div><strong>Скидки/надбавки:</strong>
                <ul>${discounts.map(d => `<li>${d}</li>`).join('')}</ul>
            </div>
        ` : ''}
    `;

    new bootstrap.Modal('#detailsModal').show();
}

// Редактирование
function openEdit(id) {
    const order = allOrders.find(o => o.id === id);
    if (!order) return;

    $('#editOrderId').value = order.id;
    $('#editDate').value = order.date_start;
    $('#editPersons').value = order.persons;
    $('#editEarly').checked = order.early_registration;
    $('#editGroup').checked = order.group_enrollment;

    // Устанавливаем выбранный курс
    $('#editCourseId').value = order.course_id;

    new bootstrap.Modal('#editModal').show();
}


async function saveEdit() {
    const id = parseInt($('#editOrderId').value);
    const order = allOrders.find(o => o.id === id);
    if (!order) {
        showNotification('Заказ не найден', 'danger');
        return;
    }

    const newCourseId = parseInt($('#editCourseId').value);
    const newDate = $('#editDate').value;
    const newPersons = parseInt($('#editPersons').value);

    // Валидация
    if (!newDate) {
        showNotification('Выберите дату начала', 'warning');
        return;
    }
    if (newPersons < 1 || newPersons > 20) {
        showNotification('Количество человек: от 1 до 20', 'warning');
        return;
    }

    const newCourse = allCourses.find(c => c.id === newCourseId);
    if (!newCourse) {
        showNotification('Курс не найден', 'danger');
        return;
    }

    // Пересчитываем цену
    const newPrice = calculateOrderPrice(newCourse, newDate, newPersons, {
        supplementary: order.supplementary || false,
        personalized: order.personalized || false,
        excursions: order.excursions || false,
        assessment: order.assessment || false,
        interactive: order.interactive || false,
        early_registration: $('#editEarly').checked,
        group_enrollment: $('#editGroup').checked
    });

    const payload = {
        course_id: newCourseId,
        date_start: newDate,
        persons: newPersons,
        early_registration: $('#editEarly').checked,
        group_enrollment: $('#editGroup').checked,
        tutor_id: order.tutor_id || 0,
        time_start: order.time_start || '',
        supplementary: order.supplementary || false,
        personalized: order.personalized || false,
        excursions: order.excursions || false,
        assessment: order.assessment || false,
        interactive: order.interactive || false,
        price: newPrice  // ✅ Теперь цена актуальна
    };

    try {
        const res = await fetch(`${BASE_URL}/orders/${id}?api_key=${API_KEY}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || `Ошибка ${res.status}`);
        }

        showNotification('✅ Заказ успешно обновлён!', 'success');

        const editModal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        if (editModal) editModal.hide();

        loadData();

    } catch (err) {
        console.error('Ошибка редактирования заказа:', err);
        showNotification(`❌ Ошибка: ${err.message}`, 'danger');
    }
}




// Удаление
function openDelete(id) {
    const order = allOrders.find(o => o.id === id);
    if (!order) return;

    currentOrder = order;
    $('#deleteOrderName').textContent = order.course?.name || 'неизвестный курс';
    new bootstrap.Modal('#deleteModal').show();
}

async function confirmDelete() {
    if (!currentOrder) {
        showNotification('Заказ не выбран', 'danger');
        return;
    }

    const orderId = currentOrder.id;

    try {
        const res = await fetch(`${BASE_URL}/orders/${orderId}?api_key=${API_KEY}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || `Ошибка ${res.status}`);
        }

        showNotification('🗑️ Заказ успешно удалён', 'success');

        // === Явно закрываем модальное окно ===
        const deleteModal = bootstrap.Modal.getInstance(document.querySelector('#deleteModal'));
        if (deleteModal) {
            deleteModal.hide();
        }

        // Очищаем текущий заказ
        currentOrder = null;

        // Обновляем таблицу
        loadData();

    } catch (err) {
        console.error('Ошибка при удалении заказа:', err);
        showNotification(`❌ Не удалось удалить: ${err.message}`, 'danger');
        // Оставляем модальное окно открытым, чтобы пользователь мог повторить
    }
}

function calculateOrderPrice(course, date_start, persons, options = {}) {
    if (!course) return 0;

    const baseFee = course.course_fee_per_hour;
    const durationHours = course.total_length * course.week_length;
    let total = baseFee * durationHours * persons;

    // Выходные
    if (date_start) {
        const day = new Date(date_start).getDay();
        if (day === 0 || day === 6) {
            total *= 1.5;
        }
    }


    // Интенсивность
    if (course.week_length >= 5) {
        total *= 1.2;
    }

    // Опции (берём из options, как в заказе)
    if (options.supplementary) total += 2000 * persons;
    if (options.personalized) total += 1500 * course.total_length;
    if (options.assessment) total += 300;
    if (options.excursions) total *= 1.25;
    if (options.interactive) total *= 1.5;

    // Скидки
    if (options.early_registration) total *= 0.9;
    if (options.group_enrollment) total *= 0.85;

    return Math.round(total);
}


// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});
