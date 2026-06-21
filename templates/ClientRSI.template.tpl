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
     * @param {String} nomMetodo - Nombre del metodo a invocar
     * @param {...any} args - Array of arguments for the payload
     * @returns {Promise<any>} Respuesta asincrona del servidor deserializada
     */
    _enviarPeticion(nomMetodo, ...args) {
        return new Promise((resolve, reject) => {
            const socket = createConnection({ port: this.port, host: this.host }, () => {
                // Marshalling (Protocolo Luismi): Formato nombreMetodo|parametro1,parametro2
                const params = args.join(',');
                const payload = `${nomMetodo}|${params}`;
                socket.write(payload);
            });

            socket.on('data', (buffer) => {
                try {
                    // Unmarshalling (Protocolo Luismi): Separar STATUS|RESULTADO
                    const respuesta = buffer.toString().trim();
                    socket.end(); // Cierre ordenado del socket tras recibir la respuesta
                    
                    const partes = respuesta.split('|');
                    const status = partes[0];
                    const data = partes[1] || '';

                    if (status === 'ERROR') return reject(new Error(data));
                    resolve(data);
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