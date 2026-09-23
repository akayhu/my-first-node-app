import express from 'express';
import cors from 'cors';
import prisma from './db.js';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello express!');
});

// POST /register → 使用者註冊
app.post('/register', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // 把密碼加密（雜湊），第二個參數 10 是「加密強度」，數字越大越安全但越花時間
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email: email,
                password: hashedPassword // 存進資料庫的是加密後的亂碼，不是原始密碼
            }
        });

        // 回傳給前端時，記得「絕對不要」把密碼（就算是加密過的）傳出去
        res.status(201).json({ id: newUser.id, email: newUser.email });
    } catch (error) {
        next(error);
    }
});

// POST /login → 使用者登入
app.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Step 1：先用 email 找出使用者
        const user = await prisma.user.findUnique({
            where: { email: email }
        });

        if (!user) {
            return res.status(401).json({ message: 'Email 或密碼錯誤' });
        }

        // Step 2：用 bcrypt 比對密碼是否正確
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email 或密碼錯誤' });
        }

        // Step 3：驗證通過，簽發 JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email }, // 要存進 Token 裡的資料
            process.env.JWT_SECRET,                  // 簽名用的密鑰
            { expiresIn: '1h' }                       // Token 有效期限：1 小時
        );

        res.json({ token: token });
    } catch (error) {
        next(error);
    }
});

// 驗證 Token 的中間件
function authenticateToken(req, res, next) {
    // Token 通常會放在請求的 Header 裡，格式是：Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // 取出 "Bearer " 後面的部分

    if (!token) {
        return res.status(401).json({ message: '請先登入' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Token 無效或已過期' });
        }

        req.user = decoded; // 把解碼出來的使用者資料，掛到 req 上，讓後面的路由可以使用
        next(); // 驗證通過，放行！
    });
}

app.get('/products', async (req, res, next) => {
    try {
        const search = req.query.search;

        const products = await prisma.product.findMany({
            where: search
                ? { name: { contains: search } } // 名稱包含關鍵字才回傳
                : undefined, // 沒有搜尋字時，回傳全部
            orderBy: { id: 'desc' } // 新上架的商品排在前面
        });

        res.json(products);
    } catch (error) {
        next(error);
    }
});

app.get('/products/:id', async (req, res, next) => {
    try {
        console.log(req.params);
        const id = Number(req.params.id);
        const product = await prisma.product.findUnique({
            where: {
                id: id
            }
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        next(error);
    }
});

app.post('/products', authenticateToken, async (req, res, next) => {
    console.log(req.body);

    try {
        const newProduct = await prisma.product.create({
            data: {
                name: req.body.name,
                price: req.body.price,
            }
        });
        res.status(201).json(newProduct);
    } catch (error) {
        next(error);
    }
});

app.put('/products/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const product = await prisma.product.findUnique({
            where: {
                id: id
            }
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updatedProduct = await prisma.product.update({
            where: {
                id: id
            },
            data: {
                name: req.body.name,
                price: req.body.price
            }
        });

        res.json(updatedProduct);
    } catch (error) {
        next(error);
    }
});

app.delete('/products/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    try {
        const product = await prisma.product.findUnique({
            where: { id: id }
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }


        await prisma.product.delete({
            where: { id: id }
        });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// POST /orders → 建立訂單（需要登入）
app.post('/orders', authenticateToken, async (req, res, next) => {
    try {
        const { items } = req.body; // [{ productId, name, price, quantity }]

        if (!items || items.length === 0) {
            return res.status(400).json({ message: '購物車是空的' });
        }

        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const order = await prisma.order.create({
            data: {
                userId: req.user.userId, // 從 Token 解碼出來的使用者 id
                items: JSON.stringify(items),
                total
            }
        });

        res.status(201).json({ ...order, items: JSON.parse(order.items) });
    } catch (error) {
        next(error);
    }
});

// GET /orders → 查詢自己的訂單（需要登入）
app.get('/orders', authenticateToken, async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({
            where: { userId: req.user.userId },
            orderBy: { id: 'desc' }
        });

        const parsed = orders.map((o) => ({ ...o, items: JSON.parse(o.items) }));
        res.json(parsed);
    } catch (error) {
        next(error);
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack); // 在後台（終端機）印出完整的錯誤細節，方便工程師除錯
    res.status(500).json({ message: '伺服器發生錯誤，請稍後再試' }); // 給客人看的，統一、乾淨的訊息
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});