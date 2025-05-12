const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db'); // Импортируем функции из db.js
require('dotenv').config();

// Создаём экземпляр Express
const app = express();
const port = process.env.PORT || 5000;

const cors = require('cors'); // Импортируем модуль CORS

// Подключаем middleware для обработки CORS
app.use(cors({
    origin: 'http://127.0.0.1:5000', // Разрешаем запросы только с этого источника
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Разрешаем методы
    allowedHeaders: ['Content-Type'], // Разрешаем заголовки
}));

// Middleware для парсинга JSON
app.use(bodyParser.json());

// Настройка статических файлов
app.use(express.static('public'));


// ------------------------------
// Маршруты для работы с товарами
// ------------------------------

// Добавление нового товара
app.post('/products', async (req, res) => {
    const { name, itemsPerPallet, quantity , price} = req.body;

    // Проверяем обязательные поля
    if (!name || !itemsPerPallet || quantity || price === undefined) {
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

// Получение списка всех товаров
app.get('/products', async (req, res) => {
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

// Маршрут для добавления количества товара
app.put('/products/:id/add-quantity', async (req, res) => {
    const productId = req.params.id; // ID товара из параметров маршрута
    const { quantityToAdd } = req.body;

    // Проверяем корректность данных
    if (!quantityToAdd || quantityToAdd <= 0) {
        return res.status(400).json({ error: 'Некорректное количество для добавления' });
    }

    const client = await pool.connect();
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

app.put('/products/:id/update', async (req, res) => {
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

// ------------------------------
// Маршруты для ABC-анализа
// ------------------------------

// Маршрут для выполнения ABC-анализа
app.post('/abc-analysis', async (req, res) => {
    try {
        await db.performAbcAnalysis(db.pool); // Передаем pool явно
        res.status(200).json({ message: 'ABC-анализ выполнен успешно' });
    } catch (error) {
        console.error('Ошибка при выполнении ABC-анализа:', error.message || error);
        res.status(500).json({ error: 'Ошибка при выполнении ABC-анализа' });
    }
});

// Маршрут для получения результатов ABC-анализа
app.get('/abc-results', async (req, res) => {
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
app.get('/product-popularity', async (req, res) => {
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



// Добавление новой продажи
app.post('/sales', async (req, res) => {
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
app.get('/sales', async (req, res) => {
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


// Маршрут для размещения товара в отстойник
app.post('/warehouse/move-to-buffer', async (req, res) => {
    const { productId } = req.body;
    if (!productId) {
        return res.status(400).json({ error: 'ID товара обязателен' });
    }
    try {
        const result = await db.moveProductToBuffer(productId);
        res.status(200).json({ message: 'Товар успешно размещен в отстойник', result });
    } catch (error) {
        console.error('Ошибка при размещении товара в отстойник:', error.message || error);
        res.status(500).json({ error: 'Ошибка при размещении товара в отстойник' });
    }
});

// Маршрут для получения текущего расположения товаров
app.get('/warehouse/layout', async (req, res) => {
    try {
        const layout = await db.getWarehouseLayout();
        res.status(200).json(layout);
    } catch (error) {
        console.error('Ошибка при получении расположения товаров:', error.message || error);
        res.status(500).json({ error: 'Ошибка при получении расположения товаров' });
    }
});


// Маршрут для получения данных ABC-анализа с размещением
app.get('/abc-analysis-layout', async (req, res) => {
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

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});

app.get('/abc-analysis', (req, res) => {
    res.sendFile(__dirname + '/public/abc-analysis.html');
});

app.get('/products', (req, res) => {
    res.sendFile(__dirname + '/public/products.html');
});

app.get('/reports', (req, res) => {
    res.sendFile(__dirname + '/public/reports.html');
});

app.get('/sales', (req, res) => {
    res.sendFile(__dirname + '/public/sales.html');
});

app.get('/warehouse-layout', (req, res) => {
    res.sendFile(__dirname + '/public/warehouse-layout.html');
});

app.get('/index', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});