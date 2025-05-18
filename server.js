const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db'); // Импортируем функции из db.js

require('dotenv').config();

const path = require('path'); // если ещё не подключал выше

// Создаём экземпляр Express
const app = express();
const port = process.env.PORT || 5000;

const cors = require('cors'); // Импортируем модуль CORS


// Подключаем middleware для обработки CORS
app.use(cors({
    origin: 'http://127.0.0.1:5000', // Разрешаем запросы только с этого источника
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Разрешаем методы
    allowedHeaders: ['Content-Type'], // Разрешаем заголовки
    credentials: true,
}));

const cookieParser = require('cookie-parser');

app.use(cors({ /* ... */ }));
app.use(bodyParser.json());
app.use(cookieParser()); // вот сюда


// Middleware для парсинга JSON
app.use(bodyParser.json());


// Страница администратора
app.get('/admin.html', requireAuth, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

// Настройка статических файлов
app.use(express.static('public'));


function requireAuth(req, res, next) {
    const session = req.cookies.session_id;
    if (!session) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    next();
}

function requireAdmin(req, res, next) {
    const role = req.cookies.role;
    if (role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещён: только для админов' });
    }
    next();
}





// ------------------------------
// Маршруты для работы с авторизацией
// ------------------------------

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Введите имя пользователя и пароль' });
    }

    try {
        const user = await db.authenticateUser(username, password);
        if (!user) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const sessionId = `${user.id}_${Date.now()}`;

        // Устанавливаем cookie
        res.cookie('session_id', sessionId, {
            httpOnly: true,
            maxAge: 60 * 60 * 1000,
            sameSite: 'Lax',
            secure: false // или true, если используешь HTTPS
        });

        res.cookie('role', user.role, {
            httpOnly: false,
            maxAge: 60 * 60 * 1000,
            sameSite: 'Lax',
            secure: false
        });

        res.status(200).json({ message: 'Вход выполнен', role: user.role });
    } catch (error) {
        console.error('Ошибка при логине:', error.message || error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('session_id');
    res.clearCookie('role');
    res.status(200).json({ message: 'Вы вышли из системы' });
});

// ------------------------------
// Маршруты для работы с товарами
// ------------------------------

//Создание товара
app.post('/api/products', requireAuth, async (req, res) => {
    const { name, itemsPerPallet, quantity , price} = req.body;
    console.log('Полученные данные:', req.body);

    // Проверяем обязательные поля
    if (!name || itemsPerPallet === undefined || quantity === undefined || price === undefined) {
        return res.status(400).json({ error: 'Название товара, количество в поддоне и количество обязательны' });
    }

    try {
        const product = await db.createProduct(name, itemsPerPallet, quantity, price);
        res.status(201).json({ message: 'Товар добавлен', product });
    } catch (err) {
        console.error('Ошибка при добавлении товара:', err.message || err);
        res.status(500).json({ error: 'Ошибка при добавлении товара' });
    }
});

//Получение списка всех товаров
app.get('/api/products', requireAuth, async (req, res) => {
    try {
        const products = await db.getAllProducts();
        // Преобразуем price в число для каждого товара
        const formattedProducts = products.map(product => ({
            ...product,
            price: parseFloat(product.price) // Преобразуем price в число
        }));
        res.status(200).json(formattedProducts);
    } catch (error) {
        console.error('Ошибка при получении списка товаров:', error.message || error);
        res.status(500).json({ error: 'Не удалось получить список товаров' });
    }
});

//Добавление количества товара
app.put('/api/products/:id/add-quantity', requireAuth, async (req, res) => {
    const productId = req.params.id; // ID товара из параметров маршрута
    const { quantityToAdd } = req.body;

    // Проверяем корректность данных
    if (!quantityToAdd || quantityToAdd <= 0) {
        return res.status(400).json({ error: 'Некорректное количество для добавления' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Получаем текущее количество товара
        const productResult = await client.query(
            'SELECT id, quantity FROM products WHERE id = $1',
            [productId]
        );

        if (productResult.rows.length === 0) {
            throw new Error('Товар не найден');
        }

        const currentQuantity = productResult.rows[0].quantity;
        const newQuantity = currentQuantity + quantityToAdd;

        // Обновляем количество товара
        await client.query(
            'UPDATE products SET quantity = $1 WHERE id = $2',
            [newQuantity, productId]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Количество товара обновлено', newQuantity });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при добавлении количества товара:', err.message || err);
        res.status(500).json({ error: 'Ошибка при добавлении количества товара' });
    } finally {
        client.release();
    }
});

//Редактирование товара
app.put('/api/products/:id/update', requireAuth, async (req, res) => {
    const productId = req.params.id;
    const { name, items_per_pallet, quantity, price } = req.body;

    // Проверяем обязательные поля
    if (!name || !items_per_pallet || quantity === undefined || price === undefined) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    try {
        const updatedProduct = await db.setupUpdateProduct(productId, name, items_per_pallet, quantity, price);
        res.status(200).json({ message: 'Товар успешно обновлен', product: updatedProduct });
    } catch (err) {
        console.error('Ошибка при обновлении товара:', err.message || err);
        res.status(500).json({ error: 'Ошибка при обновлении товара' });
    }
});

//Удаление товара
app.delete('/api/products/:id', requireAuth, async (req, res) => {
    const id = req.params.id;
    try {
        await db.deleteProduct(id);
        res.status(200).json({ message: 'Продукт удалён' });
    } catch (error) {
        console.error('Ошибка при удалении продукта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ------------------------------
// Маршруты для ABC-анализа
// ------------------------------

// Маршрут для выполнения ABC-анализа
app.post('/api/abc-analysis', requireAuth, async (req, res) => {
    try {
        await db.performAbcAnalysis(db.pool); // Передаем pool явно
        res.status(200).json({ message: 'ABC-анализ выполнен успешно' });
    } catch (error) {
        console.error('Ошибка при выполнении ABC-анализа:', error.message || error);
        res.status(500).json({ error: 'Ошибка при выполнении ABC-анализа' });
    }
});

// Маршрут для получения результатов ABC-анализа
app.get('/api/abc-results', requireAuth, async (req, res) => {
    try {
        const results = await db.getAbcResults(db.pool); // Передаем pool явно
        res.status(200).json(results); // Отправляем результаты клиенту
    } catch (error) {
        console.error('Ошибка при получении результатов ABC-анализа:', error.message || error);
        res.status(500).json({ error: 'Ошибка при получении результатов ABC-анализа' });
    }
});


// ------------------------------
// Маршруты для отчётов
// ------------------------------

// Маршрут для получения отчёта по популярности товаров
app.get('/api/product-popularity', requireAuth, async (req, res) => {
    try {
        const results = await db.getProductPopularity();
        res.status(200).json(results);
    } catch (err) {
        console.error('Ошибка при получении отчёта по популярности товаров:', err.message || err);
        res.status(500).json({ error: 'Ошибка при получении отчёта по популярности товаров' });
    }
});

// ------------------------------
// Маршруты для работы с продажами
// ------------------------------

//Добавление продажи
app.post('/api/sales', requireAuth, async (req, res) => {
    const { productId, saleDate, quantity } = req.body;

    // Проверяем обязательные поля
    if (!productId || !saleDate || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Все поля обязательны, и количество должно быть больше 0' });
    }

    try {
        // Получаем информацию о товаре из базы данных
        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Рассчитываем выручку
        const revenue = product.price * quantity;

        // Добавляем продажу в базу данных
        const newSale = await db.addSale(product.name, saleDate, quantity, revenue);

        res.status(201).json({ message: 'Продажа успешно добавлена', sale: newSale });
    } catch (error) {
        console.error('Ошибка при добавлении продажи:', error.message || error);
        res.status(500).json({ error: 'Ошибка при добавлении продажи' });
    }
});

// Получение списка всех продаж
app.get('/api/sales', requireAuth, async (req, res) => {
    try {
        const sales = await db.getAllSales();
        res.status(200).json(sales);
    } catch (error) {
        console.error('Ошибка при получении списка продаж:', error.message || error);
        res.status(500).json({ error: 'Ошибка при получении списка продаж' });
    }
});


// ------------------------------
// Маршруты для работы с размещение товаров
// ------------------------------

// Маршрут для получения текущего расположения товаров
app.get('/api/warehouse/layout', requireAuth, async (req, res) => {
    try {
        const layout = await db.getWarehouseLayout();
        res.status(200).json(layout);
    } catch (error) {
        console.error('Ошибка при получении расположения товаров:', error.message || error);
        res.status(500).json({ error: 'Ошибка при получении расположения товаров' });
    }
});

// Маршрут для получения данных ABC-анализа с размещением
app.get('/api/abc-analysis-layout', requireAuth, async (req, res) => {
    try {
        const results = await db.getAbcAnalysisWithLayout();
        res.status(200).json(results);
    } catch (error) {
        console.error('Ошибка при получении данных размещения:', error.message || error);
        res.status(500).json({ error: 'Ошибка при получении данных размещения' });
    }
});

// ------------------------------
// Маршруты для страниц
// ------------------------------

app.get('/api/check-session', requireAuth, (req, res) => {
    res.status(200).json({ message: 'Сессия активна' });
});


// Главная страница
app.get('/', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Страница ABC-анализа
app.get('/abc-analysis.html', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/public/abc-analysis.html');
});

// Страница со списком товаров
app.get('/products.html', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/public/products.html');
});

// Страница с отчётами
app.get('/reports.html', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/public/reports.html');
});

// Страница продаж
app.get('/sales.html', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/public/sales.html');
});

// Страница расположения товаров
app.get('/warehouse-layout.html', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/public/warehouse-layout.html');
});

// Страница логина (без авторизации!)
app.get('/login.html', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});