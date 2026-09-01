
import express from "express";
import cors from "cors";  //Para que el frontend pueda llamar
import infoRoutes from "./routes/info.routes.js";
import servicioRoutes from "./routes/servicio.routes.js";
import empleadoRoutes from "./routes/empleado.routes.js";
import catalogoRoutes from "./routes/catalogo.routes.js";
import clienteRoutes from "./routes/cliente.routes.js";
import citaRoutes from "./routes/cita.routes.js";
const app = express();

// Middlewares
app.use(cors());  //Permite peticiones desde cualquier origen
app.use(express.json());

// Rutas
app.use(infoRoutes);
app.use(servicioRoutes);
app.use(empleadoRoutes);
app.use(catalogoRoutes);
app.use(clienteRoutes);
app.use(citaRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no registrada." });
});

export default app;
