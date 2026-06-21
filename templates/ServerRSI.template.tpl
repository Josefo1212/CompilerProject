import { createServer } from 'net';
import { {{CLASS_NAME}}BO } from './{{CLASS_NAME}}BO.js';

/**
 * {{CLASS_NAME}}ServerRSI -- Capa de Transporte TCP (Skeleton / Lado Servidor)
 * Generado por SDL Compiler | Parte de Laura
 *
 * Escucha conexiones TCP de forma persistente, deserializa la peticion
 * entrante (unmarshalling), invoca el metodo real en el BO y devuelve
 * el resultado serializado (marshalling) al cliente.
 */
export class {{CLASS_NAME}}ServerRSI {
    constructor() {
        this.port = {{PUERTO}};
        this.bo = new {{CLASS_NAME}}BO();
    }

    /**
     * Inicializa el demonio persistente TCP para escuchar conexiones remotas.
     * El servidor permanece activo hasta que el proceso sea terminado.
     */
    iniciar() {
        const server = createServer((socket) => {
            console.log(`[SERVER_RSI] Conexion establecida desde: ${socket.remoteAddress}:${socket.remotePort}`);

            socket.on('data', async (buffer) => {
                try {
                    // Unmarshalling: desempaquetado del mensaje recibido por red
                    const { metodo, args } = JSON.parse(buffer.toString());
                    console.log(`[SERVER_RSI] Invocacion remota: ${metodo}()`);

                    switch (metodo) {
{{METODOS_SERVIDOR}}
                        default:
                            socket.write(JSON.stringify({
                                error: `Metodo '${metodo}' sin soporte remoto.`
                            }));
                    }
                } catch (err) {
                    // Marshalling del error para devolverlo al cliente
                    socket.write(JSON.stringify({
                        error: 'Fallo de procesamiento en red: ' + err.message
                    }));
                }
            });

            socket.on('error', (err) => {
                console.error(`[SOCKET ERR]: ${err.message}`);
            });

            socket.on('end', () => {
                console.log('[SERVER_RSI] Conexion cerrada por el cliente.');
            });
        });

        server.listen(this.port, () => {
            console.log(`[SERVER TCP] Escuchando activamente en el puerto ${this.port}`);
        });

        server.on('error', (err) => {
            console.error(`[SERVER ERR]: No se pudo iniciar el servidor: ${err.message}`);
        });
    }
}