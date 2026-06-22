import 'dotenv/config';
import { Proxy } from './Proxy.js';
import { createConnection } from 'net';

export class ClientRSI extends Proxy {
    constructor() {
        super();
        this.port = {{PORT}};
        this.host = process.env.SERVER_IP;
    }

    _sendRequest(methodName, ...args) {
        return new Promise((resolve, reject) => {
            const socket = createConnection({ port: this.port, host: this.host }, () => {
                const params = args.join(',');
                const payload = `${methodName}|${params}`;
                socket.write(payload);
            });

            socket.on('data', (buffer) => {
                try {
                    const response = buffer.toString().trim();
                    socket.end();
                    const parts = response.split('|');
                    const status = parts[0];
                    const data = parts[1] || '';
                    if (status === 'ERROR') return reject(new Error(data));
                    resolve(data);
                } catch (err) {
                    socket.destroy();
                    reject(new Error('Failed to decode server response: ' + err.message));
                }
            });

            socket.on('error', (err) => {
                reject(new Error('TCP transport error: ' + err.message));
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Timeout: server did not respond.'));
            });
        });
    }
}
