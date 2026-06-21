import { {{CLASS_NAME}}Proxy } from './{{CLASS_NAME}}Proxy.js';
import { createConnection } from 'net';

/**
 * {{CLASS_NAME}}ClientRSI -- Capa de Transporte TCP (Stub / Lado Cliente)
 * Generado por SDL Compiler | Parte de Laura
 *
 * Abre un socket TCP dedicado por cada invocacion remota,
 * serializa el payload (marshalling), lo transmite al servidor y
 * deserializa la respuesta (unmarshalling) de forma asincrona.
 */
export class {{CLASS_NAME}}ClientRSI extends {{CLASS_NAME}}Proxy {
    constructor() {
        super();
        this.port = {{PUERTO}};
        this.host = '{{IP}}';
    }

    /**
     * Canal centralizado de comunicacion TCP con semantica Request-Response.
     * Abre un socket por peticion y lo cierra al recibir la respuesta.
     *
     * @param {Object} payload - Objeto estructurado { metodo, args }
     * @returns {Promise<any>}  Respuesta asincrona del servidor deserializada
     */
    _enviarPeticion(payload) {
        return new Promise((resolve, reject) => {
            const socket = createConnection({ port: this.port, host: this.host }, () => {
                // Marshalling: serializacion del objeto a JSON para transmision en red
                socket.write(JSON.stringify(payload));
            });

            socket.on('data', (buffer) => {
                try {
                    // Unmarshalling: deserializacion de la respuesta recibida por red
                    const data = JSON.parse(buffer.toString());
                    socket.end(); // Cierre ordenado del socket tras recibir la respuesta

                    if (data.error) return reject(new Error(data.error));
                    resolve(data.resultado);
                } catch (err) {
                    socket.destroy();
                    reject(new Error('Error al decodificar la respuesta del servidor: ' + err.message));
                }
            });

            socket.on('error', (err) => {
                reject(new Error('Error en canal de transporte TCP: ' + err.message));
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Timeout: el servidor no respondio a tiempo.'));
            });
        });
    }

{{METODOS_CLIENTE}}
}