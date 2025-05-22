document.addEventListener('DOMContentLoaded', async () => {

    //Проверка авторизации при загрузке страницы
    const checkAuth = async () => {
        try {
            const response = await fetch('/api/check-session', {
                method: 'GET',
                credentials: 'include',
            });
    
            if (!response.ok) {
                throw new Error('Сессия недействительна');
            }
    
            const data = await response.json();
            console.log(' Сессия активна:', data);
        } catch (error) {
            console.warn(' Пользователь не авторизован:', error.message);
            window.location.href = '/login.html';
        }
    };
    

    // Функция для обработки входа
    const setupLoginForm = () => {
        const loginForm = document.getElementById('loginForm');
        const errorMessage = document.getElementById('errorMessage');
    
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
    
                try {
                    const response = await fetch('/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
    
                    if (!response.ok) throw new Error('Неверный логин или пароль');
    
                    const data = await response.json();
                    alert(data.message);
                    window.location.href = data.role === 'admin' ? '/admin.html' : '/index.html';
                } catch (error) {
                    errorMessage.textContent = error.message;
                    errorMessage.style.display = 'block';
                }
            });
        } else {
            console.warn('Форма логина не найдена в DOM.');
        }
    };

    //Функция для обработки выхода
    const setupLogoutButton = () => {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('/logout', {
                        method: 'GET',
                        credentials: 'include',
                    });
    
                    if (!response.ok) {
                        throw new Error('Ошибка при выходе');
                    }
    
                    window.location.href = '/login.html';
                } catch (error) {
                    console.error('Ошибка при выходе:', error);
                    alert(error.message || 'Не удалось выйти.');
                }
            });
        }
    };

    // Функция для настройки обработчиков ABC-анализа
    const setupAbcAnalysis = () => {
        const performAbcButton = document.getElementById('performAbcAnalysis');
        const abcResultsDiv = document.getElementById('abcResults');
    
        if (performAbcButton && abcResultsDiv) {
            performAbcButton.addEventListener('click', async () => {
                try {
                    console.log('Выполняется запрос к серверу для ABC-анализа...');
                    const response = await fetch('/api/abc-analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                    });
    
                    if (!response.ok) {
                        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
                    }
    
                    const results = await response.json();
                    console.log('Результаты ABC-анализа получены');
    
                    // Получаем актуальные результаты из базы данных
                    const abcResponse = await fetch('/api/abc-results', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                    });
    
                    if (!abcResponse.ok) {
                        throw new Error(`Ошибка сервера: ${abcResponse.status} ${abcResponse.statusText}`);
                    }
    
                    const abcResults = await abcResponse.json();
                    displayAbcResults(abcResults);
                } catch (error) {
                    console.error('Ошибка при выполнении ABC-анализа:', error);
                    alert(error.message || 'Не удалось выполнить ABC-анализ.');
                }
            });
        } else {
            console.warn('Кнопка или контейнер для ABC-анализа не найдены в DOM.');
        }
    };

    function displayAbcResults(results) {
        const abcResultsDiv = document.getElementById('abcResults');
        if (!abcResultsDiv) return;
    
        abcResultsDiv.innerHTML = ''; // Очищаем предыдущие результаты
    
        if (!Array.isArray(results) || results.length === 0) {
            abcResultsDiv.innerHTML = '<p>Нет данных для отображения</p>';
            return;
        }
    
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Наименование</th>
                    <th>Категория</th>
                    <th>Выручка</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
    
        results.forEach(item => {
            if (!item.product_name || !item.category || item.total_revenue === undefined) {
                console.error('Некорректные данные результата:', item);
                return;
            }
    
            const row = document.createElement('tr');
            row.innerHTML = `<td>${item.product_name}</td><td>${item.category}</td><td>${item.total_revenue.toFixed(2)}</td>`;
            tbody.appendChild(row);
        });
    
        abcResultsDiv.appendChild(table);
    }


    // Функция для настройки обработчиков отчёта по популярности товаров
    const setupPopularityReport = () => {
        const fetchPopularityButton = document.getElementById('fetchPopularity');
        const popularityResultsDiv = document.getElementById('popularityResults');

        if (fetchPopularityButton && popularityResultsDiv) {
            fetchPopularityButton.addEventListener('click', async () => {
                try {
                    console.log('Выполняется запрос к серверу для отчёта по популярности товаров...');
                    const response = await fetch('/api/product-popularity', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                    });

                    if (!response.ok) {
                        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
                    }

                    const results = await response.json();
                    console.log('Результаты отчёта по популярности товаров получены:', results);
                    displayPopularityResults(results);
                } catch (error) {
                    console.error('Ошибка при получении отчёта по популярности товаров:', error);
                    alert(error.message || 'Не удалось получить отчёт по популярности товаров.');
                }
            });
        } else {
            console.warn('Кнопка или контейнер для отчёта по популярности товаров не найдены в DOM.');
        }
    };

    // Функция для настройки обработчиков добавления товара
    const setupAddProduct = () => {
        const productForm = document.getElementById('productForm');
        if (productForm) {
            productForm.addEventListener('submit', async (event) => {
                event.preventDefault(); // Предотвращаем стандартную отправку формы

                const formData = {
                    name: productForm.name.value,
                    itemsPerPallet: parseInt(productForm.itemsPerPallet.value, 10),
                    quantity: parseInt(productForm.quantity.value, 10),
                    price: parseFloat(productForm.price.value),
                };

                try {
                    console.log('Отправка запроса на добавление товара:', formData);
                    const response = await fetch('/api/products', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify(formData),
                    });

                    if (!response.ok) {
                        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
                    }

                    const result = await response.json();
                    console.log('Товар успешно добавлен:', result);
                    alert('Товар успешно добавлен!');
                } catch (error) {
                    console.error('Ошибка при добавлении товара:', error);
                    alert(error.message || 'Не удалось добавить товар.');
                }
            });
        } else {
            console.warn('Форма для добавления товара не найдена в DOM.');
        }
    };


// Функция для отображения результатов популярности товаров
function displayPopularityResults(results) {
    const popularityResultsDiv = document.getElementById('popularityResults');
    if (!popularityResultsDiv) return;

    popularityResultsDiv.innerHTML = ''; // Очищаем предыдущие результаты

    if (!Array.isArray(results) || results.length === 0) {
        popularityResultsDiv.innerHTML = '<p>Нет данных для отображения</p>';
        return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Товар</th>
                <th>Количество продаж</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    results.forEach(item => {
        if (!item.name || item.salesCount === undefined) {
            console.error('Некорректные данные результата:', item);
            return;
        }

        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.name}</td><td>${item.salesCount}</td>`;
        tbody.appendChild(row);
    });

    popularityResultsDiv.appendChild(table);
}



// Функция для добавления количества товара
const setupAddToProductQuantity = () => {
    const addQuantityForm = document.getElementById('addQuantityForm');
    if (!addQuantityForm) {
        console.warn('Форма для добавления количества товара не найдена в DOM.');
        return;
    }

    addQuantityForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const productId = addQuantityForm.productSelect.value;
        const quantityToAdd = parseInt(addQuantityForm.quantityToAdd.value, 10);

        try {
            if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
                throw new Error('Количество для добавления должно быть больше нуля.');
            }

            const response = await fetch(`/api/products/${productId}/add-quantity`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ quantityToAdd }),
            });

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }

            alert('Количество товара успешно увеличено!');
        } catch (error) {
            console.error('Ошибка при добавлении количества товара:', error);
            alert(error.message || 'Не удалось добавить количество товара.');
        }
    });
};
    
// Функция для настройки обработчиков обновления данных товара
const setupUpdateProduct = () => {
    const updateForm = document.getElementById('updateForm');
    if (updateForm) {
        updateForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Предотвращаем стандартную отправку формы

            // Получаем данные из формы
            const productId = updateForm.productSelect.value;
            const newName = updateForm.name.value.trim(); // Новое название товара
            const newItemsPerPallet = parseInt(updateForm.itemsPerPallet.value, 10); // Новое количество на поддоне
            const newQuantity = parseInt(updateForm.quantity.value, 10); // Новое общее количество
            const newPrice = parseFloat(updateForm.price.value); // Новая цена

            try {
                // Проверяем корректность данных
                if (!newName || isNaN(newItemsPerPallet) || isNaN(newQuantity) || isNaN(newPrice)) {
                    throw new Error('Заполните все поля корректными данными.');
                }

                console.log('Отправка запроса на обновление данных товара:', { productId, newName, newItemsPerPallet, newQuantity, newPrice });

                // Отправляем запрос на сервер
                const response = await fetch(`/api/products/${productId}/update`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: newName,
                        items_per_pallet: newItemsPerPallet,
                        quantity: newQuantity,
                        price: newPrice, // Добавляем цену в запрос
                    }),
                });

                // Проверяем статус ответа
                if (!response.ok) {
                    throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                alert('Данные товара успешно обновлены!');
            } catch (error) {
                console.error('Ошибка при обновлении данных товара:', error);
                alert(error.message || 'Не удалось обновить данные товара.');
            }
        });
    } else {
        console.warn('Форма для обновления данных товара не найдена в DOM.');
    }
};


    
    // Функция для загрузки списка товаров в выпадающее меню
    const loadProductsIntoSelect = async () => {
        const productSelect = document.getElementById('productSelect');
        if (!productSelect) {
            console.warn('Выпадающее меню для выбора товара не найдено в DOM.');
            return;
        }
    
        try {
            console.log('Загрузка списка товаров...');
            const response = await fetch('/api/products', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
    
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }
    
            const products = await response.json();
            console.log('Список товаров получен:', products);
    
            // Очищаем предыдущие значения
            productSelect.innerHTML = '';
    
            // Заполняем выпадающее меню
            products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id; // Используем productName
                option.textContent = product.name;
                productSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Ошибка при загрузке списка товаров:', error);
            alert(error.message || 'Не удалось загрузить список товаров.');
        }
    };

    //Функция для загрузки списка товаров без редактирования
    const loadReadonlyProductList = async () => {
        const productListDiv = document.getElementById('productListReadOnly');
        if (!productListDiv) {
            console.warn('Контейнер для списка товаров не найден в DOM.');
            return;
        }
    
        try {
            console.log('Загрузка только для чтения — список товаров...');
            const response = await fetch('/api/products', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
    
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }
    
            const products = await response.json();
            console.log('Товары загружены:', products);
    
            //  Сортировка по ID (по возрастанию)
            products.sort((a, b) => a.id - b.id);
    
            productListDiv.innerHTML = '';
    
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Наименование</th>
                        <th>Единиц на поддоне</th>
                        <th>Остаток на складе (шт.)</th>
                        <th>Цена за единицу</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
    
            const tbody = table.querySelector('tbody');
    
            products.forEach(product => {
                const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
    
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.id || '—'}</td>
                    <td>${product.name || '—'}</td>
                    <td>${product.items_per_pallet || '—'}</td>
                    <td>${product.quantity || '—'}</td>
                    <td>${typeof price === 'number' ? price.toFixed(2) : '—'}</td>
                `;
                tbody.appendChild(row);
            });
    
            productListDiv.appendChild(table);
        } catch (error) {
            console.error('Ошибка при загрузке списка (только чтение):', error);
            alert(error.message || 'Не удалось загрузить список товаров.');
        }
    };
    

// Функция для загрузки и отображения списка товаров
const loadProductsList = async () => {
    const productListDiv = document.getElementById('productList');
    if (!productListDiv) {
        console.warn('Контейнер для списка товаров не найден в DOM.');
        return;
    }

    try {
        console.log('Загрузка списка товаров...');
        const response = await fetch('/api/products', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        }

        const products = await response.json();
        console.log('Список товаров получен:', products);

        // Очищаем предыдущие данные
        productListDiv.innerHTML = '';

        // Создаем таблицу для отображения товаров
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Наименование</th>
                    <th>Единиц на поддоне</th>
                    <th>Остаток на складе (шт.)</th>
                    <th>Цена за единицу</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        // Заполняем таблицу товарами
        products.forEach(product => {
            // Преобразуем price в число, если это строка
            const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;

            const row = document.createElement('tr');

            // Ячейки с данными о товаре
            row.innerHTML = `
                <td>${product.id || 'N/A'}</td>
                <td>${product.name || 'N/A'}</td>
                <td>${product.items_per_pallet || 'N/A'}</td>
                <td>${product.quantity || 'N/A'}</td>
                <td>${typeof price === 'number' ? price.toFixed(2) : 'N/A'}</td>
                <td>
                    <button class="edit-btn" data-id="${product.id}">Изменить</button>
                    <button class="delete-btn" data-id="${product.id}">Удалить</button>
                </td>
            `;

            // Обработчик для редактирования
            row.querySelector('.edit-btn').addEventListener('click', () => openEditModal(product));

            // Обработчик для удаления
            row.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm('Вы уверены, что хотите удалить этот товар?')) {
                    try {
                        const deleteResponse = await fetch(`/api/products/${product.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                        });

                        if (!deleteResponse.ok) {
                            throw new Error(`Ошибка сервера: ${deleteResponse.status} ${deleteResponse.statusText}`);
                        }

                        alert('Товар успешно удален!');
                        loadProductsList(); // Обновляем список товаров
                    } catch (error) {
                        console.error('Ошибка при удалении товара:', error);
                        alert(error.message || 'Не удалось удалить товар.');
                    }
                }
            });

            tbody.appendChild(row);
        });

        productListDiv.appendChild(table);
    } catch (error) {
        console.error('Ошибка при загрузке списка товаров:', error);
        alert(error.message || 'Не удалось загрузить список товаров.');
    }
};


// Функция для открытия модального окна редактирования
function openEditModal(product) {
    const modal = document.getElementById('editModal');
    const form = document.getElementById('updateForm');
    if (!modal || !form) {
        console.warn('Модальное окно или форма редактирования не найдены в DOM.');
        return;
    }

    // Заполняем форму данными товара
    document.getElementById('editProductId').value = product.id;
    document.getElementById('editName').value = product.name;
    document.getElementById('editItemsPerPallet').value = product.items_per_pallet;
    document.getElementById('editQuantity').value = product.quantity;
    document.getElementById('editPrice').value = product.price;

    // Показываем модальное окно
    modal.style.display = 'block';

    // Обработчик для закрытия модального окна
    document.getElementById('closeModal').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Обработчик для отправки формы
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = {
            id: document.getElementById('editProductId').value,
            name: document.getElementById('editName').value,
            itemsPerPallet: parseInt(document.getElementById('editItemsPerPallet').value, 10),
            quantity: parseInt(document.getElementById('editQuantity').value, 10),
            price: parseFloat(document.getElementById('editPrice').value),
        };
        try {
            console.log('Отправка запроса на обновление товара:', formData);
            const response = await fetch(`/api/products/${formData.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: formData.name,
                    items_per_pallet: formData.itemsPerPallet,
                    quantity: formData.quantity,
                    price: formData.price,
                }),
            });
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }
            alert('Товар успешно обновлен!');
            modal.style.display = 'none'; // Скрываем модальное окно
            loadProductsList(); // Обновляем список товаров
        } catch (error) {
            console.error('Ошибка при обновлении товара:', error);
            alert(error.message || 'Не удалось обновить товар.');
        }
    });
}


// Функция для настройки обработчиков добавления продажи
const setupAddSale = () => {
    const saleForm = document.getElementById('saleForm');
    if (!saleForm) {
        console.warn('Форма для добавления продажи не найдена в DOM.');
        return;
    }

    saleForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Получаем данные из формы
        const productSelect = saleForm.productSelect;
        const productId = productSelect.value; // ID выбранного товара
        const saleDate = saleForm.saleDate.value;
        const quantity = parseInt(saleForm.quantity.value, 10);

        // Проверяем корректность данных
        if (!productId || !saleDate || isNaN(quantity) || quantity <= 0) {
            alert('Пожалуйста, заполните все поля корректно.');
            return;
        }

        try {
            // Отправляем данные на сервер
            const response = await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId,
                    saleDate,
                    quantity,
                }),
            });

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            alert(result.message || 'Продажа успешно добавлена!');
        } catch (error) {
            console.error('Ошибка при добавлении продажи:', error);
            alert(error.message || 'Не удалось добавить продажу.');
        }
    });
};


// Функция для загрузки и отображения списка продаж
const loadSalesList = async () => {
    const salesDiv = document.getElementById('sales');
    if (!salesDiv) {
        console.warn('Контейнер для списка продаж не найден в DOM.');
        return;
    }

    try {

        const response = await fetch('/api/sales', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        }

        const sales = await response.json();
        console.log('Список продаж получен:', sales);

        // Очищаем предыдущие данные
        salesDiv.innerHTML = '';

        // Создаем таблицу для отображения продаж
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID Продажи</th>
                    <th>Наименование</th>
                    <th>Дата отгрузки</th>
                    <th>Кол-во отгружено</th>
                    <th>Выручка</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        // Заполняем таблицу продажами
        sales.forEach(sale => {
            const row = document.createElement('tr');

            // Ячейки с данными о продаже
            row.innerHTML = `
                <td>${sale.id}</td>
                <td>${sale.product_name}</td>
                <td>${new Date(sale.sale_date).toLocaleDateString()}</td>
                <td>${sale.quantity}</td>
                <td>${sale.revenue.toFixed(2)}</td>
            `;

            tbody.appendChild(row);
        });

        salesDiv.appendChild(table);
    } catch (error) {
        console.error('Ошибка при загрузке списка продаж:', error);
        alert(error.message || 'Не удалось загрузить список продаж.');
    }
};

// ------------------------------
// функции для работы с расположением товаров
// ------------------------------


    
    // Функция для просмотра расположения товаров
    const setupViewLayout = () => {
    const viewLayoutButton = document.getElementById('viewLayoutButton');
    const layoutDisplayDiv = document.getElementById('layoutDisplay');
    if (!viewLayoutButton || !layoutDisplayDiv) {
        console.warn('Кнопка или контейнер для просмотра расположения товаров не найдены в DOM.');
        return;
    }

    viewLayoutButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/warehouse/layout');
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }

            const layout = await response.json();
            displayWarehouseGridWithAbc(layout);
        } catch (error) {
            console.error('Ошибка при загрузке расположения товаров:', error);
            alert(error.message || 'Не удалось загрузить расположение товаров.');
        }
    });
};


// Функция для отображения схемы склада с товарами из ABC-анализа
const displayWarehouseGridWithAbc = async () => {
    const warehouseGridDiv = document.getElementById('warehouseGrid');
    if (!warehouseGridDiv) {
        console.warn('Контейнер для схемы склада не найден в DOM.');
        return;
    }

    // Очищаем предыдущие данные
    warehouseGridDiv.innerHTML = '';

    // Размеры склада (20x10)
    const rows = 10;
    const cols = 20;

    // Создаем пустую сетку
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            cell.classList.add('warehouse-cell');

            // Зона погрузчика (0 <= x <= 14, 6 <= y <= 9)
            if (x >= 0 && x <= 14 && y >= 6 && y <= 9) {
                cell.classList.add('loader');
                warehouseGridDiv.appendChild(cell);
                continue;
            }

            // Зона погрузчика (15 <= x <= 19, 6 <= y <= 8)
            if (x >= 15 && x <= 19 && y >= 6 && y <= 8) {
                cell.classList.add('loader');
                warehouseGridDiv.appendChild(cell);
                continue;
            }

            // Зона отстойника (0 <= x <= 2, 0 <= y <= 5)
            if (x >= 0 && x <= 2 && y >= 0 && y <= 5) {
                cell.classList.add('buffer');
                warehouseGridDiv.appendChild(cell);
                continue;
            }

            // Зона C (3 <= x <= 7, 0 <= y <= 5)
            if (x >= 3 && x <= 7 && y >= 0 && y <= 5) {
                cell.classList.add('zone-c');
                warehouseGridDiv.appendChild(cell);
                continue;
            }

            // Зона B (8 <= x <= 13, 0 <= y <= 5)
            if (x >= 8 && x <= 13 && y >= 0 && y <= 5) {
                cell.classList.add('zone-b');
                warehouseGridDiv.appendChild(cell);
                continue;
            }

            // Зона A (14 <= x <= 19, 0 <= y <= 5)
            if (x >= 14 && x <= 19 && y >= 0 && y <= 5) {
                cell.classList.add('zone-a');
                warehouseGridDiv.appendChild(cell);
                continue;
            }

            // Зона отгрузки (15 <= x <= 19, y == 9)
            if (x >= 15 && x <= 19 && y === 9) {
                cell.classList.add('shipping');
                warehouseGridDiv.appendChild(cell);
                continue;
            }

            // Пустая ячейка
            cell.classList.add('empty');
            cell.textContent = '—';
            warehouseGridDiv.appendChild(cell);
        }
    }


    // Получаем данные ABC-анализа с размещением
    try {
        const response = await fetch('/api/abc-analysis-layout');
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        }
        const layout = await response.json();
        console.log('Данные ABC-анализа:', layout);

        // Добавляем товары из layout
        layout.forEach(item => {
            const { x, y, product_id } = item;
            if (x < 0 || x >= cols || y < 0 || y >= rows) {
                console.warn(`Некорректные координаты для товара с ID "${product_id}": (x=${x}, y=${y})`);
                return;
            }
            const cellIndex = y * cols + x;
            console.log(`Товар с ID "${product_id}" с координатами (x=${x}, y=${y}) -> cellIndex=${cellIndex}`);
            const cell = warehouseGridDiv.children[cellIndex];
            if (cell) {
                cell.textContent = `#${product_id}`;
            }
        });
    } catch (error) {
        console.error('Ошибка при загрузке данных ABC-анализа:', error);
        alert(error.message || 'Не удалось загрузить данные ABC-анализа.');
    }
};

const isLoginPage = window.location.pathname.includes('login.html');
if (!isLoginPage) {
    await checkAuth();  // только если это НЕ login.html
}

// Функция для экономического закупа
const loadPurchasePlan = async () => {
    const tableDiv = document.getElementById('planTable');
    if (!tableDiv) {
        console.warn('Контейнер для плана закупа не найден в DOM.');
        return;
    }

    try {
        const response = await fetch('/api/purchase-plan', {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки данных');
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            tableDiv.innerHTML = '<p>Нет товаров, требующих закупа.</p>';
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Товар</th>
                    <th>Средний спрос в день</th>
                    <th>Остаток на складе</th>
                    <th>Дней осталось</th>
                    <th>Рекомендуемый объём закупа</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.product_name}</td>
                <td>${item.avg_daily_sales}</td>
                <td>${item.current_stock}</td>
                <td>${item.days_left < 1 ? 'менее 1 дня' : Math.round(item.days_left)}</td>
                <td><strong>${item.recommended_to_buy}</strong></td>
            `;
            tbody.appendChild(row);
        });

        tableDiv.appendChild(table);
    } catch (error) {
        console.error('Ошибка при загрузке плана закупа:', error);
        tableDiv.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
};


    // Инициализация функционала
    setupLoginForm();
    setupAbcAnalysis();
    setupPopularityReport();
    setupAddProduct();
    setupUpdateProduct();
    setupAddToProductQuantity();
    setupViewLayout();
    displayPopularityResults();
    setupAddSale();
    setupLogoutButton();
    loadReadonlyProductList();

    await displayWarehouseGridWithAbc();
    await loadProductsIntoSelect();
    await loadProductsList();
    await loadSalesList();
    await loadPurchasePlan();

    const roleCookie = document.cookie.split('; ').find(row => row.startsWith('role='));
    const role = roleCookie ? roleCookie.split('=')[1] : null;

    if (role !== 'admin') {
        const adminNavItem = document.querySelector('a[href="/admin.html"]')?.parentElement;
        if (adminNavItem) {
            adminNavItem.remove(); // Или: adminNavItem.style.display = 'none';
        }
    }
});

