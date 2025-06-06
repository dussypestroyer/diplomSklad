const { Pool } = require('pg');
require('dotenv').config();

// Создаём пул подключений к базе данных
const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

// Тестирование подключения к базе данных
pool.on('connect', () => {
    console.log('Успешное подключение к базе данных');
});

pool.on('error', (err) => {
    console.error('Ошибка подключения к базе данных:', err);
});

// Авторизация пользователя
async function authenticateUser(username, password) {
    try {
        const result = await pool.query(`
            SELECT id, username, password, role
            FROM users
            WHERE username = $1
        `, [username]);

        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];

        // Простейшая проверка пароля (в проде — использовать bcrypt!)
        if (user.password !== password) {
            return null;
        }

        return {
            id: user.id,
            username: user.username,
            role: user.role
        };
    } catch (err) {
        console.error('Ошибка при проверке пользователя:', err.message || err);
        throw new Error('Ошибка авторизации');
    }
}


// Функция для создания нового товара и его автоматическое размещение в зоне buffer
async function createProduct(productName, itemsPerPallet, quantity, price) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Добавляем товар в таблицу products
        const productResult = await client.query(`
            INSERT INTO products (name, items_per_pallet, quantity, price)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [productName, itemsPerPallet, quantity, price]);

        const productId = productResult.rows[0].id;

        // Размещаем товар в зоне buffer
        await placeProductInBuffer(client, productId);

        await client.query('COMMIT');
        console.log('Товар успешно создан и размещен в отстойник');
        return productId;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при создании товара:', err.message || err);
        throw new Error('Не удалось создать товар');
    } finally {
        client.release();
    }
}

// Вспомогательная функция для размещения товара в зоне buffer
async function placeProductInBuffer(client, productId) {
    try {
        // 1. Сформируем пул всех возможных координат в buffer (обратный порядок: справа налево, снизу вверх)
        const bufferCells = [];
        for (let y = 5; y >= 0; y--) {
            for (let x = 2; x >= 0; x--) {
                bufferCells.push({ x, y });
            }
        }

        // 2. Получим уже занятые координаты
        const result = await client.query(`
            SELECT x, y
            FROM warehouse_layout
            WHERE zone = 'buffer'
        `);
        const occupied = new Set(result.rows.map(row => `${row.x},${row.y}`));

        // 3. Найдём первую свободную ячейку
        const freeCell = bufferCells.find(cell => !occupied.has(`${cell.x},${cell.y}`));
        if (!freeCell) {
            throw new Error('Отстойник (buffer) заполнен — невозможно разместить новый товар');
        }

        // 4. Размещаем товар
        await client.query(`
            INSERT INTO warehouse_layout (product_id, zone, x, y, priority)
            VALUES ($1, 'buffer', $2, $3, 1)
            ON CONFLICT (product_id) DO UPDATE SET zone = 'buffer', x = $2, y = $3, priority = 1
        `, [productId, freeCell.x, freeCell.y]);

        console.log(`Товар ${productId} размещён в зоне buffer на (${freeCell.x}, ${freeCell.y})`);
    } catch (err) {
        console.error('Ошибка при размещении товара в отстойник:', err.message || err);
        throw new Error('Не удалось разместить товар в отстойник');
    }
}




// 2. Редактирование товара
async function setupUpdateProduct(productId, name, itemsPerPallet, quantity, price) {

    console.log('Функция setupUpdateProduct вызвана с параметрами:', { productId, name, itemsPerPallet, quantity, price });
    try {
        console.log('Попытка обновления товара:', { productId, name, itemsPerPallet, quantity, price });
        const result = await pool.query(
            'UPDATE products SET name = $1, items_per_pallet = $2, quantity = $3, price = $4 WHERE id = $5 RETURNING *',
            [name, itemsPerPallet, quantity, price, productId]
        );

        if (result.rowCount === 0) {
            console.warn('Товар не найден:', { productId });
            throw new Error('Товар не найден');
        }

        console.log('Товар успешно обновлён:', result.rows[0]);
        return result.rows[0];
    } catch (err) {
        console.error('Ошибка при обновлении товара:', err.message || err);
        throw new Error('Не удалось обновить товар');
    }
}

//Удаление товара
async function deleteProduct(id) {
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
        return result.rowCount; // может быть полезно, если нужно узнать — был ли удалён товар
    } catch (error) {
        console.error('Ошибка при удалении товара из базы:', error);
        throw error;
    }
}

// Функция добавления количества товара
async function addToProductQuantity(productId, quantityToAdd) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const productResult = await client.query(
            'SELECT id, quantity FROM products WHERE id = $1',
            [productId]
        );
        if (productResult.rows.length === 0) {
            throw new Error('Товар не найден');
        }
        const currentQuantity = productResult.rows[0].quantity;
        const newQuantity = currentQuantity + quantityToAdd;
        await client.query(
            'UPDATE products SET quantity = $1 WHERE id = $2',
            [newQuantity, productId]
        );
        await client.query('COMMIT');
        return { productId, newQuantity };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при добавлении количества товара:', err.message || err);
        throw new Error('Не удалось добавить количество товара');
    } finally {
        client.release();
    }
}




// 3. Получение всех товаров
async function getAllProducts() {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
        return result.rows;
    } catch (err) {
        throw new Error('Не удалось получить список товаров');
    }
}

// Функция для получения товара по ID
async function getProductById(productId) {
    try {
        console.log('Попытка получения товара по ID:', { productId });
        const result = await pool.query(
            'SELECT * FROM products WHERE id = $1',
            [productId]
        );

        if (result.rowCount === 0) {
            console.warn('Товар не найден по айди:', { productId });
            return null;
        }

        console.log('Товар получен:', result.rows[0]);
        return result.rows[0];
    } catch (err) {
        console.error('Ошибка при получении товара:', err.message || err);
        throw new Error('Не удалось получить товар');
    }
}


// Функция для получения товара по имени
async function getProductByName(productName) {
    try {
        console.log('Попытка получения товара по имени:', { productName });
        const result = await pool.query(
            'SELECT * FROM products WHERE name = $1',
            [productName]
        );
        if (result.rowCount === 0) {
            console.warn('Товар не найден:', { productName });
            return null;
        }
        console.log('Товар получен:', result.rows[0]);
        return result.rows[0];
    } catch (err) {
        console.error('Ошибка при получении товара:', err.message || err);
        throw new Error('Не удалось получить товар');
    }
}


// Добавление записи о продаже
async function addSale(productName, saleDate, quantity, revenue) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверяем, существует ли товар с указанным названием
        const productResult = await client.query(
            'SELECT id, quantity FROM products WHERE name = $1',
            [productName]
        );

        if (productResult.rows.length === 0) {
            throw new Error('Товар с указанным названием не найден');
        }

        const productId = productResult.rows[0].id;
        const currentQuantity = productResult.rows[0].quantity;

        // Проверяем, достаточно ли товара на складе
        if (currentQuantity < quantity) {
            throw new Error('Недостаточно товара на складе');
        }

        // Добавляем запись о продаже
        const saleResult = await client.query(
            'INSERT INTO sales (product_name, sale_date, quantity, revenue) VALUES ($1, $2, $3, $4) RETURNING *',
            [productName, saleDate, quantity, revenue]
        );

        // Уменьшаем количество товара на складе
        await client.query(
            'UPDATE products SET quantity = quantity - $1 WHERE id = $2',
            [quantity, productId]
        );

        await client.query('COMMIT');
        console.log('Продажа успешно добавлена:', saleResult.rows[0]);
        return saleResult.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при добавлении продажи:', err.message || err);
        throw err;
    } finally {
        client.release();
    }
}
// 5. Получение всех продаж
async function getAllSales() {
    try {
        console.log('Попытка получения всех продаж');
        const result = await pool.query('SELECT * FROM sales ORDER BY sale_date DESC');

        // Преобразуем revenue в число, если это необходимо
        const sales = result.rows.map(sale => ({
            ...sale,
            revenue: parseFloat(sale.revenue) || 0 // Преобразуем в число или устанавливаем 0, если значение некорректно
        }));


        return sales;
    } catch (err) {
        console.error('Ошибка при получении списка продаж:', err.message || err);
        throw new Error('Не удалось получить список продаж');
    }
}

// 6. Обновление размещения товаров на складе
async function updateWarehouseLayout(productId, x, y, priority) {
    if (x < 0 || x >= 20 || y < 0 || y >= 10) {
        throw new Error(`Некорректные координаты (x=${x}, y=${y}). Допустимые значения: x от 0 до 19, y от 0 до 9.`);
    }
    try {
        console.log('Попытка обновления размещения товара:', { productId, x, y, priority });
        const result = await pool.query(
            `
            INSERT INTO warehouse_layout (product_id, x, y, priority) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (product_id) DO UPDATE SET x = $2, y = $3, priority = $4 
            RETURNING *
            `,
            [productId, x, y, priority]
        );
        console.log('Размещение товара успешно обновлено:', result.rows[0]);
        return result.rows[0];
    } catch (err) {
        console.error('Ошибка при обновлении размещения:', err.message || err);
        throw new Error('Не удалось обновить размещение товара на складе');
    }
}

// 7. Сохранение результатов ABC-анализа
async function saveAbcAnalysisResults(productName, analysisDate, category, totalQuantity, totalRevenue, productId) {
    try {
        console.log('Попытка сохранения результатов ABC-анализа:', { productName, analysisDate, category, totalQuantity, totalRevenue, productId });
        const result = await pool.query(
            `
            INSERT INTO abc_analysis_results (product_name, analysis_date, category, total_quantity, total_revenue, product_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
            `,
            [productName, analysisDate, category, totalQuantity, totalRevenue, productId]
        );
        console.log('Результаты ABC-анализа успешно сохранены:', result.rows[0]);
        return result.rows[0];
    } catch (err) {
        console.error('Ошибка при сохранении результатов ABC-анализа:', err.message || err);
        throw new Error('Не удалось сохранить результаты ABC-анализа');
    }
}

// 8. Получение отчёта по популярности товаров
async function getProductPopularity() {
    try {
        console.log('Попытка получения отчёта по популярности товаров');
        const result = await pool.query(`
        SELECT
            p.name AS name,
            COALESCE(COUNT(s.product_name), 0) AS "salesCount"
        FROM products p
        LEFT JOIN sales s ON p.name = s.product_name
        GROUP BY p.name
        ORDER BY "salesCount" DESC;
        `);


        return result.rows;
    } catch (err) {
        console.error('Ошибка при получении популярности товаров:', err.message || err);
        throw new Error('Не удалось получить данные о популярности товаров');
    }
}


// 9. Выполнение ABC-анализа
async function performAbcAnalysis(pool) {
    const client = await pool.connect();
    try {
        console.log('Начало выполнения ABC-анализа');
        await client.query('BEGIN');

        // Очистка таблиц
        console.log('Очистка таблицы abc_analysis_results...');
        await client.query('DELETE FROM abc_analysis_results');
        console.log('Таблица abc_analysis_results очищена');

        console.log('Очистка временной таблицы temp_abc_analysis...');
        await client.query('DROP TABLE IF EXISTS temp_abc_analysis');
        console.log('Временная таблица очищена');

        // Создание временной таблицы
        console.log('Создание временной таблицы temp_abc_analysis...');
        await client.query(`
            CREATE TEMP TABLE temp_abc_analysis AS
            SELECT
                p.id AS product_id,
                p.name AS product_name,
                SUM(s.quantity * p.price) AS total_revenue
            FROM sales s
            JOIN products p ON s.product_name = p.name
            GROUP BY p.id, p.name
        `);
        console.log('Временная таблица создана');

        // Добавление столбца cumulative_revenue
        console.log('Добавление столбца cumulative_revenue...');
        await client.query(`
            ALTER TABLE temp_abc_analysis ADD COLUMN cumulative_revenue NUMERIC;

            UPDATE temp_abc_analysis
            SET cumulative_revenue = subquery.cumulative_revenue
            FROM (
                SELECT
                    product_id,
                    SUM(total_revenue) OVER (ORDER BY total_revenue DESC) AS cumulative_revenue
                FROM temp_abc_analysis
            ) AS subquery
            WHERE temp_abc_analysis.product_id = subquery.product_id;
        `);
        console.log('Cumulative revenue рассчитан');

        // Расчет категорий A, B, C
        console.log('Расчет категорий A, B, C...');
        await client.query(`
            ALTER TABLE temp_abc_analysis ADD COLUMN category CHAR(1);

            UPDATE temp_abc_analysis
            SET category = CASE
                WHEN cumulative_revenue / (SELECT SUM(total_revenue) FROM temp_abc_analysis) <= 0.7 THEN 'A'
                WHEN cumulative_revenue / (SELECT SUM(total_revenue) FROM temp_abc_analysis) <= 0.9 THEN 'B'
                ELSE 'C'
            END;
        `);
        console.log('Категории рассчитаны');

        // Сохранение результатов ABC-анализа
        console.log('Сохранение результатов ABC-анализа...');
        await client.query(`
            INSERT INTO abc_analysis_results (product_name, analysis_date, category, total_revenue, product_id)
            SELECT
                product_name,
                NOW() AS analysis_date,
                category,
                total_revenue,
                product_id
            FROM temp_abc_analysis
            WHERE product_id IS NOT NULL;
        `);
        console.log('Результаты ABC-анализа сохранены');

        // Размещение товаров в зонах
        console.log('Размещение товаров в зонах A, B, C...');
        await placeProductsInZones(client); // Передаем клиент в функцию

        await client.query('COMMIT');
        console.log('ABC-анализ выполнен успешно');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при выполнении ABC-анализа:', err.message || err);
        throw new Error('Не удалось выполнить ABC-анализ');
    } finally {
        client.release();
    }
}

// Вспомогательная функция для размещения товаров в зонах
async function placeProductsInZones(client) {
    const zones = {
        A: [],
        B: [],
        C: [],
    };

    // Заполняем пулы свободных ячеек
    for (let y = 0; y <= 5; y++) {
        for (let x = 14; x <= 19; x++) zones.A.push({ x, y }); // Зона A
        for (let x = 8; x <= 13; x++) zones.B.push({ x, y }); // Зона B
        for (let x = 3; x <= 7; x++) zones.C.push({ x, y }); // Зона C
    }

    // Получаем результаты ABC-анализа
    const abcResults = await getAbcResults(client);

    // Размещаем товары в пулах
    for (const row of abcResults) {
        const { product_id, category } = row;

        if (!product_id) {
            console.warn(`Пропущена запись с NULL product_id в категории ${category}`);
            continue;
        }

        if (!zones[category] || zones[category].length === 0) {
            console.warn(`Нет свободных ячеек в зоне ${category} для товара с ID ${product_id}`);
            continue;
        }

        const { x, y } = zones[category].pop(); // Берем первую свободную ячейку

        // Добавляем запись в таблицу warehouse_layout
        await client.query(`
            INSERT INTO warehouse_layout (product_id, zone, x, y, priority)
            VALUES ($1, $2, $3, $4, 1)
            ON CONFLICT (product_id) DO UPDATE SET zone = $2, x = $3, y = $4, priority = 1
        `, [product_id, category, x, y]);

    }
}

//Получение результатов АВС-анализа
async function getAbcResults(pool) {
    try {
        console.log('Попытка получения результатов ABC-анализа');
        const result = await pool.query(`
            SELECT *
            FROM abc_analysis_results
            ORDER BY analysis_date DESC
        `);

        // Преобразуем total_revenue в число
        result.rows.forEach(row => {
            row.total_revenue = parseFloat(row.total_revenue);
        });

        return result.rows;
    } catch (err) {
        console.error('Ошибка при получении результатов ABC-анализа:', err.message || err);
        throw new Error('Не удалось получить результаты ABC-анализа');
    }
}

// ------------------------------
// Работа с размещением товаров
// ------------------------------


// Функция для получения текущего расположения товаров на складе
async function getWarehouseLayout() {
    try {
        const result = await pool.query(`
            SELECT product_id, zone, x, y
            FROM warehouse_layout
            ORDER BY zone, y, x
        `);
        return result.rows;
    } catch (err) {
        console.error('Ошибка при получении расположения товаров:', err.message || err);
        throw new Error('Не удалось получить расположение товаров');
    }
}


// Функция для получения данных ABC-анализа с размещением товаров
async function getAbcAnalysisWithLayout() {
    try {
        const result = await pool.query(`
        SELECT
            wl.product_id,
            wl.zone,
            wl.x,
            wl.y
        FROM warehouse_layout wl
        ORDER BY wl.zone, wl.y, wl.x
        `);
        console.log('Результаты запроса getAbcAnalysisWithLayout:', result.rows);
        return result.rows;
    } catch (err) {
        console.error('Ошибка при получении данных размещения:', err.message || err);
        throw new Error('Не удалось получить данные размещения');
    }
}

//Функция экономического закупа
async function calculatePurchasePlan() {
    const client = await pool.connect();
    try {
        // Получаем средние продажи за последние 30 дней по каждому товару
        const salesQuery = `
            SELECT 
                product_name,
                SUM(quantity) AS total_sold,
                COUNT(DISTINCT sale_date) AS days_with_sales,
                MAX(sale_date) AS last_sale_date
            FROM sales
            WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY product_name
        `;
        const salesResult = await client.query(salesQuery);

        // Получаем текущие остатки
        const productsResult = await client.query('SELECT id, name, quantity FROM products');

        const productsMap = {};
        productsResult.rows.forEach(p => {
            productsMap[p.name] = p;
        });

        const now = new Date();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        const plan = [];

        for (const row of salesResult.rows) {
            const productName = row.product_name;
            const product = productsMap[productName];

            if (!product) continue; // Пропускаем товары, которых нет в базе

            const avgDailySales = row.total_sold / Math.max(row.days_with_sales, 1);
            const stockLeft = product.quantity;
            const daysLeft = stockLeft / Math.max(avgDailySales, 0.1); // Защита от деления на 0
            const neededStock = avgDailySales * 7;
            const toBuy = Math.ceil(Math.max(neededStock - stockLeft, 0));

            if (toBuy > 0) {
                plan.push({
                    product_id: product.id,
                    product_name: productName,
                    avg_daily_sales: parseFloat(avgDailySales.toFixed(2)),
                    current_stock: stockLeft,
                    days_left: parseFloat(daysLeft.toFixed(2)),
                    recommended_to_buy: toBuy,
                });
            }
        }

        return plan;
    } catch (err) {
        console.error('Ошибка при расчёте закупа:', err.message || err);
        throw new Error('Не удалось рассчитать план закупа');
    } finally {
        client.release();
    }
}

// Экспортируем функции
module.exports = {
    pool,
    createProduct,
    getAllProducts,
    addSale,
    getAllSales,
    setupUpdateProduct,
    updateWarehouseLayout,
    saveAbcAnalysisResults,
    getProductById,
    getProductByName,
    addToProductQuantity,
    getProductPopularity,
    performAbcAnalysis,
    getAbcResults,
    deleteProduct,
    getWarehouseLayout,
    getAbcAnalysisWithLayout,
    placeProductsInZones,
    placeProductInBuffer,
    authenticateUser,
    calculatePurchasePlan,
};


