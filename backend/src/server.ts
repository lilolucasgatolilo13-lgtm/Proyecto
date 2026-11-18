import 'dotenv/config'; // B-02, C-01: Cargar variables de entorno desde .env
import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
