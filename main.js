/**
 * Глобальные константы конфигурации
 */
const API_KEY = 'cb5b3b0c-7518-4730-86c3-79454ef67a44';
const BASE_URL = 'http://exam-api-courses.std-900.ist.mospolytech.ru/api';

/**
 * Вспомогательные функции
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function getLevelText(level) {
    const levels = {
        'Beginner': 'Начальный',
        'Intermediate': 'Средний',
        'Advanced': 'Продвинутый'
    };
    return levels[level] || level;
}

function getLevelBadgeClass(level) {
    const classes = {
        'Beginner': 'bg-success',
        'Intermediate': 'bg-warning',
        'Advanced': 'bg-danger'
    };
    return classes[level] || 'bg-secondary';
}

function calculateCourseEndDate(startDate, weeks) {
    const start = new Date(startDate);
    start.setDate(start.getDate() + (weeks * 7));
    return formatDate(start.toISOString().split('T')[0]);
}

function checkEarlyRegistration(dateString) {
    if (!dateString) return false;
    const startDate = new Date(dateString);
    const today = new Date();
    const diffInMonths = (startDate.getFullYear() - today.getFullYear()) * 12 + 
                       (startDate.getMonth() - today.getMonth());
    return diffInMonths >= 1;
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationArea');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi ${type === 'success' ? 'bi-check-circle' : 
                              type === 'danger' ? 'bi-exclamation-triangle' : 
                              type === 'warning' ? 'bi-exclamation-circle' : 
                              'bi-info-circle'} me-2"></i>
                ${escapeHtml(message)}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                    data-bs-dismiss="toast" aria-label="Закрыть"></button>
        </div>
    `;
    
    container.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

function showLoading(elementId, message = 'Загрузка...') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Загрузка...</span>
            </div>
            <p class="mt-2 text-muted">${escapeHtml(message)}</p>
        </div>
    `;
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div class="text-center py-5">
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${escapeHtml(message)}
            </div>
        </div>
    `;
}

/**
 * Глобальное состояние приложения
 */
let allCourses = [];
let allTutors = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 5;
let selectedCourse = null;
let selectedTutor = null;

/**
 * Инициализация при загрузке DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchCourses();
    fetchTutors();
    setupEventListeners();
    initMap();
    initSmoothScroll();
    initActiveNavHighlight();
});

/**
 * Настройка плавной прокрутки
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                history.pushState(null, null, targetId);
            }
        });
    });
}

/**
 * Подсветка активного раздела навигации
 */
function initActiveNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    window.addEventListener('scroll', () => {
        let current = '';
        const scrollPos = window.scrollY + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

/**
 * Настройка глобальных слушателей событий
 */
function setupEventListeners() {
    // Поиск курсов
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            currentPage = 1;
            renderCourses();
        });

        const searchInput = document.getElementById('courseSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => {
                currentPage = 1;
                renderCourses();
            }, 300));
        }
    }

    // Фильтры репетиторов
    const tutorQualFilter = document.getElementById('tutorQualFilter');
    const tutorExpFilter = document.getElementById('tutorExpFilter');
    
    if (tutorQualFilter) {
        tutorQualFilter.addEventListener('change', () => renderTutors());
    }
    if (tutorExpFilter) {
        tutorExpFilter.addEventListener('input', debounce(() => renderTutors(), 300));
    }

    // Динамический расчет стоимости
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        const costTriggers = orderForm.querySelectorAll('input, select');
        costTriggers.forEach(trigger => {
            trigger.addEventListener('change', updateTotalPrice);
        });
        
        const numberInputs = orderForm.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            input.addEventListener('input', updateTotalPrice);
        });
    }

    // Слушатель выбора даты для разблокировки времени
    const dateSelect = document.getElementById('date_start');
    if (dateSelect) {
        dateSelect.addEventListener('change', (e) => {
            const timeSelect = document.getElementById('time_start');
            timeSelect.disabled = !e.target.value;
            if (e.target.value) {
                populateTimes(e.target.value);
            }
            updateTotalPrice();
        });
    }

    // Отправка формы заказа
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    }
    
    // Обновляем карту при изменении размеров окна
    window.addEventListener('resize', debounce(() => {
        if (document.getElementById('map') && typeof ymaps !== 'undefined' && window.myMap) {
            setTimeout(() => {
                window.myMap.container.fitToViewport();
            }, 300);
        }
    }, 250));
}

/**
 * Получение списка курсов через Fetch API
 */
async function fetchCourses() {
    try {
        showLoading('coursesGrid', 'Загрузка курсов...');
        const response = await fetch(`${BASE_URL}/courses?api_key=${API_KEY}`);
        if (!response.ok) throw new Error('Ошибка загрузки курсов');
        allCourses = await response.json();
        renderCourses();
    } catch (error) {
        console.error('Ошибка загрузки курсов:', error);
        showError('coursesGrid', 'Не удалось загрузить курсы. Проверьте подключение к API.');
    }
}

/**
 * Рендеринг карточек курсов с пагинацией
 */
function renderCourses() {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    const searchTerm = (document.getElementById('courseSearchInput')?.value || '').toLowerCase();
    const filtered = allCourses.filter(course =>
        course.name.toLowerCase().includes(searchTerm) ||
        course.level.toLowerCase().includes(searchTerm)
    );

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);

    if (paginated.length === 0) {
        grid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info text-center py-5">
                    <i class="bi bi-search fs-1 d-block mb-3"></i>
                    <h5>Курсы не найдены</h5>
                    <p class="mb-0">Попробуйте изменить критерии поиска</p>
                </div>
            </div>
        `;
        renderPagination(filtered.length);
        return;
    }

    grid.innerHTML = paginated.map(course => {
        const isSelected = selectedCourse && selectedCourse.id === course.id;
        return `
            <div class="col">
                <div class="card h-100 shadow-sm border-0 cursor-pointer ${isSelected ? 'border-primary border-3 shadow-lg' : 'border-0'}"
                    onclick="selectCourse(${course.id})">
                    
                    <!-- Иконка "выбрано" -->
                    <div class="position-absolute top-0 end-0 m-2 ${isSelected ? 'd-block' : 'd-none'}">
                        <i class="bi bi-check-circle text-primary fs-5"></i>
                    </div>

            <div class="card-body">
                        <span class="badge ${getLevelBadgeClass(course.level)} mb-2">${getLevelText(course.level)}</span>
                        <h5 class="card-title">${escapeHtml(course.name)}</h5>
                        <p class="card-text text-muted small">${escapeHtml(course.description.substring(0, 120))}...</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold fs-5 text-primary">${course.course_fee_per_hour} ₽/час</span>
                            <div class="text-end">
                                <small class="d-block text-muted">${course.total_length} недель</small>
                                <small class="d-block text-muted">${course.week_length} ч/нед</small>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer bg-transparent border-0 pb-3">
                        
                    </div>
                </div>
            </div>
        `;
    }).join('');

    
    renderPagination(filtered.length);
}

function selectCourse(courseId) {
    selectedCourse = allCourses.find(c => c.id === courseId) || null;
    renderCourses(); // Перерисовываем, чтобы обновить выделение
    showNotification(
        selectedCourse ? `Курс выбран: ${selectedCourse.name}` : 'Курс снят',
        selectedCourse ? 'success' : 'info'
    );
}

/**
 * Отрисовка кнопок пагинации
 */
function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const pagination = document.getElementById('coursesPagination');
    if (!pagination) return;

    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    // Предыдущая страница
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <button class="page-link" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="bi bi-chevron-left"></i>
        </button>
    `;
    prevLi.onclick = currentPage > 1 ? () => {
        currentPage--;
        renderCourses();
        document.getElementById('coursesSection')?.scrollIntoView({ behavior: 'smooth' });
    } : null;
    pagination.appendChild(prevLi);

    // Номера страниц
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<button class="page-link">${i}</button>`;
        li.onclick = () => {
            currentPage = i;
            renderCourses();
            document.getElementById('coursesSection')?.scrollIntoView({ behavior: 'smooth' });
        };
        pagination.appendChild(li);
    }

    // Следующая страница
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <button class="page-link" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="bi bi-chevron-right"></i>
        </button>
    `;
    nextLi.onclick = currentPage < totalPages ? () => {
        currentPage++;
        renderCourses();
        document.getElementById('coursesSection')?.scrollIntoView({ behavior: 'smooth' });
    } : null;
    pagination.appendChild(nextLi);
}

/**
 * Загрузка репетиторов
 */
async function fetchTutors() {
    try {
        showLoading('tutorsTableBody', 'Загрузка репетиторов...');
        const response = await fetch(`${BASE_URL}/tutors?api_key=${API_KEY}`);
        if (!response.ok) throw new Error('Ошибка загрузки репетиторов');
        allTutors = await response.json();
        renderTutors();
    } catch (error) {
        console.error('Ошибка загрузки репетиторов:', error);
        showError('tutorsTableBody', 'Не удалось загрузить репетиторов.');
    }
}

/**
 * Рендеринг таблицы репетиторов
 */
function renderTutors() {
    const tbody = document.getElementById('tutorsTableBody');
    if (!tbody) return;

    const qualFilter = document.getElementById('tutorQualFilter')?.value || '';
    const expFilter = parseInt(document.getElementById('tutorExpFilter')?.value) || 0;

    const filtered = allTutors.filter(t => {
        const matchQual = !qualFilter || t.language_level === qualFilter;
        const matchExp = t.work_experience >= expFilter;
        return matchQual && matchExp;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5">
                    <div class="alert alert-warning">
                        <i class="bi bi-search me-2"></i>Репетиторы не найдены
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(t => `
        <tr class="${selectedTutor && selectedTutor.id === t.id ? 'table-primary' : ''}">
            <td>
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=0d6efd&color=fff" 
                     class="rounded-circle" alt="${escapeHtml(t.name)}" width="40" height="40">
            </td>
            <td><strong>${escapeHtml(t.name)}</strong></td>
            <td><span class="badge ${getLevelBadgeClass(t.language_level)}">${t.language_level}</span></td>
            <td>${escapeHtml(t.languages_offered?.join(', ') || 'Не указано')}</td>
            <td>
                <span class="badge bg-info">${t.work_experience} лет</span>
            </td>
            <td>
                <span class="fw-bold text-success">${t.price_per_hour} ₽/час</span>
            </td>
            <td>
                <button class="btn btn-sm ${selectedTutor && selectedTutor.id === t.id ? 'btn-primary' : 'btn-outline-primary'}" 
                        onclick="selectTutor(${t.id})">
                    ${selectedTutor && selectedTutor.id === t.id ? 
                        '<i class="bi bi-check-circle me-1"></i>Выбран' : 
                        '<i class="bi bi-plus-circle me-1"></i>Выбрать'}
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Выбор репетитора
 */
function selectTutor(id) {
    selectedTutor = allTutors.find(t => t.id === id) || null;
    renderTutors();
    showNotification(
        selectedTutor ? `Выбран репетитор: ${selectedTutor.name}` : 'Репетитор отменен',
        selectedTutor ? 'success' : 'info'
    );
}

/**
 * Подготовка модального окна заказа
 */
function prepareOrder(courseId) {
    selectedCourse = allCourses.find(c => c.id === courseId);
    if (!selectedCourse) {
        showNotification('Курс не найден', 'danger');
        return;
    }

    // 1. Устанавливаем курс
    document.getElementById('modalCourseName').value = selectedCourse.name;

    // 2. Устанавливаем преподавателя:
    //    Если выбран репетитор — его имя, иначе teacher из курса
    const teacherName = selectedTutor 
        ? selectedTutor.name 
        : (selectedCourse.teacher || 'Не указан');

    document.getElementById('modalTeacherName').value = teacherName;

    // 3. Продолжительность
    const durationEl = document.getElementById('modalDuration');
    durationEl.value = `${selectedCourse.total_length} нед.`;
    durationEl.setAttribute('data-weeks', selectedCourse.total_length);

    // 4. Даты начала
    const dateSelect = document.getElementById('date_start');
    if (dateSelect && selectedCourse.start_dates) {
        const uniqueDates = [...new Set(selectedCourse.start_dates.map(d => d.split('T')[0]))].sort();
        dateSelect.innerHTML = '<option value="" disabled selected>Выберите дату</option>' +
            uniqueDates.map(d => `<option value="${d}">${formatDate(d)}</option>`).join('');
    }

    // 5. Время — сброс
    const timeSelect = document.getElementById('time_start');
    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="" disabled selected>Сначала выберите дату</option>';

    // 6. Количество студентов
    document.getElementById('persons').value = 1;

    // 7. Сбрасываем чекбоксы
    document.querySelectorAll('#orderOptions input[type="checkbox"]').forEach(cb => cb.checked = false);

    // 8. Обновляем стоимость
    updateTotalPrice();

    // 9. Открываем модальное окно
    const modal = new bootstrap.Modal(document.getElementById('orderModal'));
    modal.show();
}


/**
 * Проверка автоматических скидок
 */
function checkAutoDiscounts() {
    const persons = parseInt(document.getElementById('persons')?.value) || 1;
    
    if (persons >= 5) {
        showNotification('Групповая скидка 15% применена!', 'success');
    }
}

/**
 * Заполнение доступного времени на основе даты
 */
function populateTimes(date) {
    const timeSelect = document.getElementById('time_start');
    if (!timeSelect || !selectedCourse || !selectedCourse.start_dates) return;

    const availableTimes = selectedCourse.start_dates
        .filter(d => d.startsWith(date))
        .map(d => d.split('T')[1].substring(0, 5));

    if (availableTimes.length === 0) {
        timeSelect.innerHTML = '<option value="" selected disabled>Время недоступно</option>';
        return;
    }

    timeSelect.innerHTML = '<option value="" selected disabled>Выберите время</option>' +
        availableTimes.map(t => {
            const [hours, minutes] = t.split(':');
            const hour = parseInt(hours);
            const endHour = hour + 2;
            return `<option value="${t}">${t} - ${endHour.toString().padStart(2, '0')}:${minutes}</option>`;
        }).join('');
    
    updateEndDateDisplay(date);
    updateTotalPrice();
}

/**
 * Отображение даты окончания курса
 */
function updateEndDateDisplay(startDate) {
    const durationElement = document.getElementById('modalDuration');
    const weeks = parseInt(durationElement.getAttribute('data-weeks')) || selectedCourse.total_length;
    
    if (startDate && weeks) {
        const endDate = calculateCourseEndDate(startDate, weeks);
        durationElement.value = `${weeks} нед. (последнее занятие: ${endDate})`;
    }
}

/**
 * Расчет стоимости заявки
 */
function updateTotalPrice() {
    if (!selectedCourse) return;

    const courseFee = selectedCourse.course_fee_per_hour;
    const durationHours = selectedCourse.total_length * selectedCourse.week_length;
    const numPersons = parseInt(document.getElementById('persons')?.value) || 1;
    const startDateVal = document.getElementById('date_start')?.value;
    const startTimeVal = document.getElementById('time_start')?.value;

    // Выходные дни
    let isWeekendOrHoliday = 1.0;
    if (startDateVal) {
        const date = new Date(startDateVal);
        const day = date.getDay();
        if (day === 0 || day === 6) {
            isWeekendOrHoliday = 1.5;
        }
    }

    // Доплаты за время
    let morningSurcharge = 0;
    let eveningSurcharge = 0;
    if (startTimeVal) {
        const hour = parseInt(startTimeVal.split(':')[0]);
        if (hour >= 9 && hour < 12) morningSurcharge = 400;
        if (hour >= 18 && hour < 20) eveningSurcharge = 1000;
    }

    // Базовый расчет
    let total = ((courseFee * durationHours * isWeekendOrHoliday) + morningSurcharge + eveningSurcharge) * numPersons;

    // Интенсивный курс
    if (selectedCourse.week_length >= 5) {
        total *= 1.2;
    }

    // Дополнительные опции
    if (document.getElementById('supplementary')?.checked) {
        total += (2000 * numPersons);
    }
    if (document.getElementById('personalized')?.checked) {
        total += (1500 * selectedCourse.total_length);
    }
    if (document.getElementById('assessment')?.checked) {
        total += 300;
    }

    // Процентные модификаторы
    if (document.getElementById('excursions')?.checked) {
        total *= 1.25;
    }
    if (document.getElementById('interactive')?.checked) {
        total *= 1.5;
    }

    // АВТОМАТИЧЕСКИЕ СКИДКИ
    
    // Скидка за групповую запись
    if (numPersons >= 5) {
        total *= 0.85;
    }
    
    // Скидка за раннюю регистрацию
    if (startDateVal) {
        const startDate = new Date(startDateVal);
        const today = new Date();
        const diffInMonths = (startDate.getFullYear() - today.getFullYear()) * 12 + 
                           (startDate.getMonth() - today.getMonth());
        if (diffInMonths >= 1) {
            total *= 0.9;
        }
    }

    // Округляем
    total = Math.round(total);

    // Обновляем отображение
    const display = document.getElementById('totalPriceDisplay');
    if (display) {
        display.innerText = `${total.toLocaleString('ru-RU')} ₽`;
    }
}

/**
 * Обработчик отправки формы заказа
 */
async function handleOrderSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        showNotification('Пожалуйста, заполните все обязательные поля', 'warning');
        return;
    }

    if (!selectedCourse) {
        showNotification('Курс не выбран', 'danger');
        return;
    }

    const startDateVal = document.getElementById('date_start')?.value;
    if (!startDateVal) {
        showNotification('Выберите дату начала', 'warning');
        return;
    }

    const timeStartVal = document.getElementById('time_start')?.value;
    if (!timeStartVal) {
        showNotification('Выберите время занятия', 'warning');
        return;
    }

    const persons = parseInt(document.getElementById('persons')?.value) || 1;
    
    const payload = {
        course_id: selectedCourse.id,
        tutor_id: selectedTutor?.id || 0,
        date_start: startDateVal,
        time_start: timeStartVal,
        duration: selectedCourse.total_length * selectedCourse.week_length,
        persons: persons,
        price: parseInt(document.getElementById('totalPriceDisplay').innerText.replace(/\D/g, '')),
        early_registration: checkEarlyRegistration(startDateVal),
        group_enrollment: persons >= 5,
        intensive_course: selectedCourse.week_length >= 5,
        supplementary: document.getElementById('supplementary')?.checked || false,
        personalized: document.getElementById('personalized')?.checked || false,
        excursions: document.getElementById('excursions')?.checked || false,
        assessment: document.getElementById('assessment')?.checked || false,
        interactive: document.getElementById('interactive')?.checked || false
    };

    try {
        const response = await fetch(`${BASE_URL}/orders?api_key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Логирование ответа сервера
        console.log('HTTP статус:', response.status);
        
        const text = await response.text(); // Сначала получаем как текст
        console.log('Рaw ответ сервера:', text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (jsonError) {
            console.error('Не удалось распарсить JSON:', text);
            throw new Error('Сервер вернул некорректный ответ (не JSON)');
        }

        // Теперь проверяем логику приложения
        if (!response.ok) {
            throw new Error(data.error || `Ошибка ${response.status}: ${response.statusText}`);
        }

        // Проверка на бизнес-логику
        if (data.success === false) {
            throw new Error(data.message || 'Ошибка при создании заявки');
        }

        // Успешный кейс
        showNotification('✅ Заявка успешно создана!', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('orderModal'));
        modal.hide();

        setTimeout(() => {
            window.location.href = 'cabinet.html';
        }, 2000);

} catch (error) {
    console.error('Ошибка при отправке заявки:', error);
    showNotification(`❌ Ошибка: ${error.message}`, 'danger');
}

}

// Кнопка записи на курс
function openGeneralOrderForm() {
    if (!selectedCourse) {
        showNotification('Выберите курс, чтобы подать заявку', 'warning');
        return;
    }

    // Заполняем форму выбранным курсом
    document.getElementById('modalCourseName').value = selectedCourse.name;

    const teacherName = selectedTutor 
        ? selectedTutor.name 
        : (selectedCourse.teacher || 'Не указан');
    document.getElementById('modalTeacherName').value = teacherName;

    // Продолжительность
    const durationEl = document.getElementById('modalDuration');
    durationEl.value = `${selectedCourse.total_length} нед.`;
    durationEl.setAttribute('data-weeks', selectedCourse.total_length);

    // Даты
    const dateSelect = document.getElementById('date_start');
    if (selectedCourse.start_dates) {
        const uniqueDates = [...new Set(selectedCourse.start_dates.map(d => d.split('T')[0]))].sort();
        dateSelect.innerHTML = '<option value="" disabled selected>Выберите дату</option>' +
            uniqueDates.map(d => `<option value="${d}">${formatDate(d)}</option>`).join('');
        dateSelect.disabled = false;
    } else {
        dateSelect.innerHTML = '<option value="" disabled>Нет доступных дат</option>';
        dateSelect.disabled = true;
    }

    // Сбрасываем время
    const timeSelect = document.getElementById('time_start');
    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="" disabled selected>Сначала выберите дату</option>';

    // Количество студентов
    document.getElementById('persons').value = 1;

    // Снимаем все чекбоксы
    document.querySelectorAll('#orderOptions input[type="checkbox"]').forEach(cb => cb.checked = false);

    // Обновляем стоимость
    updateTotalPrice();

    // Открываем модальное окно
    const modal = new bootstrap.Modal(document.getElementById('orderModal'));
    modal.show();
}


/**
 * Инициализация карты Яндекс
 */
function initMap() {
    if (typeof ymaps === 'undefined') {
        console.warn('Yandex Maps API не загружена');
        showNotification('Карта временно недоступна', 'warning');
        return;
    }
    
    ymaps.ready(() => {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;

        window.myMap = new ymaps.Map(mapElement, {
            center: [55.7558, 37.6173],
            zoom: 11,
            controls: ['zoomControl', 'fullscreenControl']
        });

        // Добавляем метки 
        const resources = [
            {
                coordinates: [55.781444, 37.711300],
                properties: {
                    balloonContent: `
                        <div style="padding: 10px;">
                            <h4>Московский Политех</h4>
                            <p><strong>Адрес:</strong> ул. Большая Семёновская, 38/25</p>
                            <p><strong>Часы работы:</strong> 9:00-20:00</p>
                            <p>Большая коллекция литературы на иностранных языках</p>
                        </div>
                    `,
                    hintContent: 'Московский Политех'
                },
                options: {
                    preset: 'islands#blueLibraryIcon'
                }
            },
            
        ];

        resources.forEach(resource => {
            const placemark = new ymaps.Placemark(
                resource.coordinates,
                resource.properties,
                resource.options
            );
            window.myMap.geoObjects.add(placemark);
        });
    });
}