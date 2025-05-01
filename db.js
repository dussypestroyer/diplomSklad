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

// Создание нового товара
async function createProduct(name, items_per_pallet, quantity, price) {
    try {
        console.log('Попытка создания нового товара:', { name, items_per_pallet, quantity, price });
        const result = await pool.query(
            'INSERT INTO products (name, items_per_pallet, quantity, price) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, items_per_pallet, quantity, price]
        );

        console.log('Товар успешно создан:', result.rows[0]);
        return result.rows[0];
    } catch (err) {
        console.error('Ошибка при создании товара:', err.message || err);
        throw new Error('Не удалось создать товар');
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
        console.error('Ошибка при получении списка товаров:', err.message || err);
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
async function saveAbcAnalysisResults(productName, analysisDate, category, totalQuantity, totalRevenue) {
    try {
        console.log('Попытка сохранения результатов ABC-анализа:', { productName, analysisDate, category, totalQuantity, totalRevenue });
        const result = await pool.query(
            `
            INSERT INTO abc_analysis_results (product_name, analysis_date, category, total_quantity, total_revenue) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
            `,
            [productName, analysisDate, category, totalQuantity, totalRevenue]
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
async function performAbcAnalysis() {
    const client = await pool.connect();
    try {
        console.log('Начало выполнения ABC-анализа');
        await client.query('BEGIN');

        // Шаг 1: Очистка основной таблицы
        await client.query('DELETE FROM abc_analysis_results');
        console.log('Таблица abc_analysis_results очищена');

        // Шаг 1: Очистка временной таблицы
        await client.query('DROP TABLE IF EXISTS temp_abc_analysis');
        console.log('Временная таблица очищена');

        // Шаг 2: Создание временной таблицы для анализа
        await client.query(`
            CREATE TEMP TABLE temp_abc_analysis AS
            SELECT
                p.id AS product_id,
                p.name AS product_name,
                COALESCE(SUM(s.revenue), 0) AS total_revenue
            FROM products p
            LEFT JOIN sales s ON p.name = s.product_name
            GROUP BY p.id, p.name
            ORDER BY total_revenue DESC
        `);
        console.log('Временная таблица создана');

        // Если данных нет, возвращаем пустой результат
        const checkData = await client.query('SELECT COUNT(*) FROM temp_abc_analysis');
        if (checkData.rows[0].count === '0') {
            await client.query('COMMIT');
            console.log('ABC-анализ выполнен успешно (данных нет)');
            return [];
        }

        // Шаг 3: Добавление столбца cumulative_revenue
        await client.query(`
            ALTER TABLE temp_abc_analysis ADD COLUMN cumulative_revenue NUMERIC;
        `);

        // Шаг 4: Расчёт накопленной выручки
        await client.query(`
            UPDATE temp_abc_analysis
            SET cumulative_revenue = (
                SELECT SUM(total_revenue)
                FROM temp_abc_analysis t2
                WHERE t2.total_revenue >= temp_abc_analysis.total_revenue
            );
        `);
        console.log('Добавлен столбец cumulative_revenue');

        // Шаг 5: Добавление столбца category
        await client.query(`
            ALTER TABLE temp_abc_analysis ADD COLUMN category TEXT;
        `);

        // Шаг 6: Расчёт категорий
        await client.query(`
            UPDATE temp_abc_analysis
            SET category = CASE
                WHEN cumulative_revenue / (SELECT SUM(total_revenue) FROM temp_abc_analysis) <= 0.7 THEN 'A'
                WHEN cumulative_revenue / (SELECT SUM(total_revenue) FROM temp_abc_analysis) <= 0.9 THEN 'B'
                ELSE 'C'
            END;
        `);
        console.log('Категории рассчитаны');

        // Шаг 7: Сохранение результатов в основную таблицу
        await client.query(`
        INSERT INTO abc_analysis_results (product_name, analysis_date, category, total_quantity, total_revenue)
        SELECT
            product_name,
            CURRENT_DATE AS analysis_date,
            category,
            NULL AS total_quantity,
            total_revenue
        FROM temp_abc_analysis
         `);
        console.log('Результаты ABC-анализа сохранены');

        await client.query('COMMIT');
        console.log('ABC-анализ выполнен успешно');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при выполнении ABC-анализа:', err.message || err);
        throw new Error('Не удалось выполнить ABC-анализ');
    } finally {
        client.release();
        console.log('Подключение к базе данных освобождено');
    }
}

// 10. Получение результатов ABC-анализа
async function getAbcResults() {
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

// Функция для размещения товара в отстойник
async function moveProductToBuffer(productId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверяем, существует ли товар
        const productResult = await client.query(
            'SELECT id FROM products WHERE id = $1',
            [productId]
        );

        if (productResult.rows.length === 0) {
            throw new Error('Товар с указанным ID не найден');
        }

        // Размещаем товар в отстойник (зона "buffer", координаты по умолчанию)
        const result = await client.query(
            'INSERT INTO warehouse_layout (product_id, zone, x, y) VALUES ($1, $2, $3, $4) ON CONFLICT (product_id) DO UPDATE SET zone = $2, x = $3, y = $4 RETURNING *',
            [productId, 'buffer', 0, 0] // Зона "buffer", координаты (0, 0)
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при размещении товара в отстойник:', err.message || err);
        throw new Error('Не удалось разместить товар в отстойник');
    } finally {
        client.release();
    }
}

// Функция для получения текущего расположения товаров на складе
async function getWarehouseLayout() {
    try {
        const result = await pool.query(
            'SELECT product_id, zone, x, y FROM warehouse_layout'
        );
        return result.rows;
    } catch (err) {
        console.error('Ошибка при получении расположения товаров:', err.message || err);
        throw new Error('Не удалось получить расположение товаров');
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
    moveProductToBuffer,
    getWarehouseLayout,
};

