const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const MySQLStore = require('express-mysql-session')(session);
const { format } = require('@fast-csv/format');


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Conexión a base de datos.
const db = mysql.createPool({ 
    host:'localhost',
    user:'root',
    password:'',
    database:'eecommerce'
});

// guardar sesiones en MySQL
const sessionStore = new MySQLStore({}, db);

app.use(session({ 
    secret:'valor', 
    resave: false, 
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: false, // true si usas HTTPS
        maxAge: 1000 * 60 * 60 // 1 hora
    }
}));

app.use(express.json()); // parse json
app.use(express.urlencoded({extended:true})); // parse form


// Inicio de servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Login
app.post('/login', async (req, res) => {
    const { correo, contrasena } = req.body;
    const [rows] = await db.query('SELECT * FROM usuarios WHERE correo = ? LIMIT 1', [correo]);
    if (rows.length > 0) {
        const user = rows[0];
        if (await bcrypt.compare(contrasena, user.contrasena)) {
            req.session.userid = user.id;
            req.session.role = user.role;
            req.session.nombre = user.nombre;

            return res.status(200).json({ success: true, redirect: user.role === 'admin' ? "/menuadmin.html" : "/cuenta.html" });
        } else {
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }
    } else {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
});


// Registro

app.post('/registro', async (req, res) => {
    const { nombre, correo, contrasena, role } = req.body;

    if (!nombre || !correo || !contrasena) {
        return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    try {
        const [usuarios] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
        if (usuarios.length > 0) {
            return res.status(400).json({ success: false, message: 'Este correo ya está registrado' });
        }

        const hashed = await bcrypt.hash(contrasena, 10);
        await db.query(
            'INSERT INTO usuarios (nombre, correo, contrasena, role) VALUES (?, ?, ?, ?)',
            [nombre, correo, hashed, role]
        );

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});


// Cierre de sesión
app.post('/cerrar_sesion', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});


//  Guardar producto
app.post('/guardar_producto', async (req, res) => {
    const { nombre, precio, stock } = req.body;

    console.log('🧾 Datos recibidos:', req.body); 

    if (!nombre || !precio || !stock) {
        return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
    }

    try {
        const sql = 'INSERT INTO Productos (nombre, precio, stock) VALUES (?, ?, ?)';
        await db.query(sql, [nombre, precio, stock]);
        res.json({ mensaje: 'Producto guardado con éxito' });
    } catch (err) {
        console.error('❌ Error al insertar producto:', err);
        res.status(500).json({ mensaje: 'Error al guardar el producto' });
    }
});


// Obtener productos
app.get('/productos', (req, res) => {
    if (fs.existsSync('productos.json')) {
        const productos = JSON.parse(fs.readFileSync('productos.json'));
        res.json(productos);
    } else {
        res.json([]);
    }
});


app.post('/comprar', async (req, res) => {
    const { nombre, cantidad } = req.body;
    const nombre_comprador = req.session?.nombre || 'Anónimo';


    if (!nombre || isNaN(cantidad)) {
        return res.status(400).json({ mensaje: 'Datos inválidos' });
    }

    try {
        // Obtener producto
        const [productos] = await db.query('SELECT id, stock FROM Productos WHERE nombre = ?', [nombre]);
        if (productos.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        const producto = productos[0];
        if (producto.stock < cantidad) {
            return res.status(400).json({ mensaje: `Stock insuficiente para "${nombre}"` });
        }

        // Restar stock
        await db.query('UPDATE Productos SET stock = stock - ? WHERE id = ?', [cantidad, producto.id]);

        // Registrar venta
        const fecha_venta = new Date();
        await db.query(
            'INSERT INTO Ventas (producto_id, cantidad, fecha_venta, nombre_comprador) VALUES (?, ?, ?, ?)',
            [producto.id, cantidad, fecha_venta, nombre_comprador]
        );

        res.json({ mensaje: 'Compra realizada con éxito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});



// Mensaje de contacto
app.post('/contacto', async (req, res) => {
    const { nombre, correo, telefono, asunto, mensaje } = req.body;

    if (!nombre || !correo || !telefono || !asunto || !mensaje) {
        return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    try {
        const fecha = new Date(); // Fecha actual

        await db.query(`
            INSERT INTO Mensajes (nombre, correo, telefono, asunto, mensaje, fecha)
            VALUES (?, ?, ?, ?, ?, CURRENT_DATE())
        `, [nombre, correo, telefono, asunto, mensaje, fecha]);

        res.status(200).json({ success: true, mensaje: 'Mensaje enviado correctamente' });
    } catch (error) {
        console.error('Error al guardar el mensaje:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});


// Revisa la sesión activa.
app.get('/sesion-activa', (req, res) => {
    if (req.session.userid) {
        res.json({
            loggedIn: true,
            userid: req.session.userid,
            role: req.session.role
        });
    } else {
        res.json({ loggedIn: false });
    }
});


// Ruta para obtener el stock por ID de producto
app.get('/producto-stock/:id', async (req, res) => {
    const id = req.params.id;
    console.log("Buscando stock para ID:", id);

    try {
     
        const [rows] = await db.execute(
            'SELECT stock FROM Productos WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ stock: rows[0].stock });
    } catch (error) {
        console.error('Error en consulta a la DB:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


app.get('/api/productos', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Productos');
        res.json(rows); // Envía todos los productos como JSON
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

app.put('/api/productos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, precio, stock } = req.body;

    if (!nombre || isNaN(precio) || isNaN(stock)) {
        return res.status(400).json({ mensaje: 'Datos inválidos' });
    }

    try {
        await db.query(
            'UPDATE Productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?',
            [nombre, precio, stock, id]
        );
        res.json({ mensaje: 'Producto actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error del servidor al actualizar' });
    }
});

app.delete('/api/productos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM Productos WHERE id = ?', [id]);
        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar producto' });
    }
});


// Obtener lista de usuarios
app.get('/api/usuarios', async (req, res) => {
    try {
        const [usuarios] = await db.query('SELECT id, nombre, correo, role FROM usuarios');
        res.json(usuarios);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

// Cambiar rol de usuario
app.put('/api/usuarios/:id/rol', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'usuario'].includes(role)) {
        return res.status(400).json({ mensaje: 'Rol inválido' });
    }

    try {
        await db.query('UPDATE usuarios SET role = ? WHERE id = ?', [role, id]);
        res.json({ mensaje: 'Rol actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar rol:', error);
        res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

// Eliminar usuario
app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

//graficas

app.get('/api/resumen', async (req, res) => {
    try {
        const [productos] = await db.query('SELECT COUNT(*) AS total FROM Productos');
        const [stockBajo] = await db.query('SELECT COUNT(*) AS bajos FROM Productos WHERE stock <= 5');
        const [usuarios] = await db.query('SELECT COUNT(*) AS total FROM usuarios');
        const [roles] = await db.query(`
            SELECT 
                SUM(role = 'admin') AS admins,
                SUM(role = 'usuario') AS usuarios
            FROM usuarios
        `);

        res.json({
            totalProductos: productos[0].total,
            stockBajo: stockBajo[0].bajos,
            totalUsuarios: usuarios[0].total,
            admins: roles[0].admins,
            usuariosNormales: roles[0].usuarios
        });
    } catch (error) {
        console.error('Error al generar resumen:', error);
        res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

// Obtener ventas
app.get('/ventas', async (req, res) => {
    try {
        const [ventas] = await db.query(`
            SELECT V.id, P.nombre AS producto, V.cantidad, V.fecha_venta, V.nombre_comprador
            FROM Ventas V
            JOIN Productos P ON V.producto_id = P.id
            ORDER BY V.fecha_venta DESC
        `);
        res.json(ventas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener ventas' });
    }
});

// Filtro ventas

app.get('/ventas/filtro', async (req, res) => {
    const { fecha_inicio, fecha_fin, producto } = req.query;
    let condiciones = [];
    let valores = [];

    if (fecha_inicio && fecha_fin) {
        condiciones.push('V.fecha_venta BETWEEN ? AND ?');
        valores.push(fecha_inicio, fecha_fin);
    }

    if (producto) {
        condiciones.push('P.nombre LIKE ?');
        valores.push(`%${producto}%`);
    }

    const whereClause = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

    try {
        const [ventas] = await db.query(`
            SELECT V.id, P.nombre AS producto, V.cantidad, V.fecha_venta, V.nombre_comprador
            FROM Ventas V
            JOIN Productos P ON V.producto_id = P.id
            ${whereClause}
            ORDER BY V.fecha_venta DESC
        `, valores);

        res.json(ventas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al filtrar ventas' });
    }
});


// Exportar

app.get('/ventas/exportar', async (req, res) => {
    try {
        const [ventas] = await db.query(`
            SELECT V.id, P.nombre AS producto, V.cantidad, V.fecha_venta, V.nombre_comprador
            FROM Ventas V
            JOIN Productos P ON V.producto_id = P.id
            ORDER BY V.fecha_venta DESC
        `);

        res.setHeader('Content-disposition', 'attachment; filename=ventas.csv');
        res.set('Content-Type', 'text/csv');

        const csvStream = format({ headers: true });
        csvStream.pipe(res);
        ventas.forEach(row => csvStream.write(row));
        csvStream.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al exportar CSV' });
    }
});