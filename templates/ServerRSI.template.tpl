import 'dotenv/config';
import { createServer } from 'net';
import { Service } from './Service.js';

export class ServerRSI {
    constructor() {
        this.port = {{PORT}};
        this.service = new Service();
    }

    start() {
        const server = createServer((socket) => {
            console.log(`[SERVER_RSI] Connection from: ${socket.remoteAddress}:${socket.remotePort}`);

            socket.on('data', async (buffer) => {
                try {
                    const message = buffer.toString().trim();
                    const parts = message.split('|');
                    const method = parts[0];
                    const argsStr = parts[1] || '';
                    const args = argsStr ? argsStr.split(',') : [];
                    console.log(`[SERVER_RSI] Remote call: ${method}() with args: ${argsStr}`);

                    switch (method) {
{{SERVER_METHODS}}
                        default:
                            socket.write(`ERROR|Method '${method}' not supported.`);
                    }
                } catch (err) {
                    socket.write(`ERROR|Network processing error: ${err.message}`);
                }
            });

            socket.on('error', (err) => {
                console.error(`[SOCKET ERR]: ${err.message}`);
            });

            socket.on('end', () => {
                console.log('[SERVER_RSI] Connection closed by client.');
            });
        });

        server.listen(this.port, process.env.SERVER_IP, () => {
            console.log(`[SERVER TCP] Listening on port ${this.port}`);
        });

        server.on('error', (err) => {
            console.error(`[SERVER ERR]: Failed to start server: ${err.message}`);
        });
    }
}
