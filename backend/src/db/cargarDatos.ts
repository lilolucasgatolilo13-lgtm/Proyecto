import { cargarDatosIniciales } from './datosIniciales';
import { obtenerBaseDatos } from './conexion';

console.log('Cargando datos iniciales de prueba...');
cargarDatosIniciales(obtenerBaseDatos());
console.log('¡Datos iniciales cargados con éxito!');
