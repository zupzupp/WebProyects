-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS eecommerce;
USE eecommerce;

-- Creamos la tabla de usuario
CREATE TABLE usuarios (
id INT AUTO_INCREMENT PRIMARY KEY,
nombre VARCHAR(250),
correo VARCHAR(250) UNIQUE,
contrasena VARCHAR(250)
);

SELECT * FROM usuarios;

DELETE FROM usuarios WHERE id=2;


ALTER TABLE usuarios ADD COLUMN role ENUM('admin', 'usuario') NOT NULL;


CREATE TABLE Productos(
id INT AUTO_INCREMENT PRIMARY KEY,
nombre VARCHAR(250) NOT NULL,
precio INT NOT NULL,
stock INT NOT NULL
);


INSERT INTO Productos(nombre, precio, stock) VALUES
("Kirby and the Forgotten Land", 8000, 5),
("Minecraft", 6000, 2),
("Omori", 7000, 7),
("Keep Talking And Nobody Explodes", 3000, 4),
("Among Us", 1000, 15),
("Animal Crossing", 15000, 1),
("Danganronpa Trigger Happy Havoc", 10000, 3),
("Super Smash Bros.™ Ultimate", 20000, 6),
("Splatoon 3", 20000, 6),
("Super Mario Party Jamboree", 8000, 5);


SELECT * FROM PRODUCTOS;

SELECT stock FROM Productos WHERE id = 5;

CREATE TABLE Ventas (
id INT AUTO_INCREMENT PRIMARY KEY,
producto_id INT NOT NULL,
cantidad INT NOT NULL,
fecha_venta DATETIME NOT NULL,
nombre_comprador VARCHAR(250) NOT NULL,
FOREIGN KEY (producto_id) REFERENCES Productos(id)
);

CREATE TABLE Mensajes(
id INT AUTO_INCREMENT PRIMARY KEY,
nombre VARCHAR(250) NOT NULL,
correo VARCHAR(250) NOT NULL,
telefono VARCHAR(250) NOT NULL,
asunto VARCHAR(250) NOT NULL,
mensaje VARCHAR(1000) NOT NULL,
fecha DATETIME NOT NULL
);

SELECT * FROM Mensajes;

