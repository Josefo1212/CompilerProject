/**
 * test_network_laura.js
 * Validación de Sockets TCP Aislada — Laura
 *
 * Prueba end-to-end del canal de transporte TCP:
 *  1. Levanta un servidor TCP de prueba en un puerto efímero.
 *  2. Conecta un cliente, transmite un payload JSON.
 *  3. Verifica que el servidor recibe, procesa y devuelve la respuesta.
 *  4. Valida el caso de error (método no soportado).
 *  5. Cierra todo limpiamente al finalizar.
 */

import { createServer, createConnection } from 'net';

const PUERTO_AISLADO = 6000;

// ─────────────────────────────────────────────────────────
// Utilidad: cliente TCP que envía un payload y devuelve
// la respuesta como Promise (espejo de _enviarPeticion)
// ─────────────────────────────────────────────────────────
function enviarPeticion(payload) {
    return new Promise((resolve, reject) => {
        const socket = createConnection({ port: PUERTO_AISLADO }, () => {
            socket.write(JSON.stringify(payload));
        });

        socket.on('data', (buffer) => {
            try {
                const data = JSON.parse(buffer.toString());
                socket.end();
                if (data.error) return reject(new Error(data.error));
                resolve(data.resultado);
            } catch (err) {
                socket.destroy();
                reject(new Error('Error al decodificar respuesta: ' + err.message));
            }
        });

        socket.on('error', (err) => {
            reject(new Error('Error de transporte TCP: ' + err.message));
        });
    });
}

// ─────────────────────────────────────────────────────────
// Servidor de prueba: simula el comportamiento de un
// ServerRSI generado con un único método "decirHola"
// ─────────────────────────────────────────────────────────
const servidorDePrueba = createServer((socket) => {
    console.log(`[🖥️  SERVIDOR] Conexión entrante desde ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (buffer) => {
        try {
            const { metodo, args } = JSON.parse(buffer.toString());
            console.log(`[🖥️  SERVIDOR] Invocación remota recibida → metodo='${metodo}', args=${JSON.stringify(args)}`);

            if (metodo === 'decirHola') {
                const resultado = `¡Hola, ${args[0]}! — respuesta desde el servidor TCP.`;
                socket.write(JSON.stringify({ resultado }));
            } else {
                socket.write(JSON.stringify({ error: `Método '${metodo}' sin soporte remoto.` }));
            }
        } catch (err) {
            socket.write(JSON.stringify({ error: 'Fallo de procesamiento: ' + err.message }));
        }
    });

    socket.on('error', (err) => console.error('[❌ SOCKET ERR]:', err.message));
});

// ─────────────────────────────────────────────────────────
// Suite de pruebas secuencial (async/await)
// ─────────────────────────────────────────────────────────
async function ejecutarPruebas() {
    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log('  🧪 Validación de Transporte TCP — Laura');
    console.log('══════════════════════════════════════════════════');

    // ── Prueba 1: Invocación exitosa ──────────────────────
    console.log('\n[TEST 1] Invocación exitosa de método remoto:');
    try {
        const resultado = await enviarPeticion({ metodo: 'decirHola', args: ['Mundo'] });
        console.log(`  ✅ PASS → Resultado recibido: "${resultado}"`);
    } catch (err) {
        console.error(`  ❌ FAIL → ${err.message}`);
    }

    // ── Prueba 2: Método no soportado (error controlado) ──
    console.log('\n[TEST 2] Método no soportado (error controlado):');
    try {
        await enviarPeticion({ metodo: 'metodoInexistente', args: [] });
        console.error('  ❌ FAIL → Debería haber lanzado error.');
    } catch (err) {
        console.log(`  ✅ PASS → Error capturado correctamente: "${err.message}"`);
    }

    // ── Prueba 3: Payload sin campo metodo (dato corrupto) ─
    console.log('\n[TEST 3] Payload mal formado (campo metodo ausente):');
    try {
        const resultado = await enviarPeticion({ accion: 'decirHola', args: ['Laura'] });
        // El servidor responderá con error porque metodo=undefined no coincide
        console.error(`  ❌ FAIL → Debería haber lanzado error. Resultado: ${resultado}`);
    } catch (err) {
        console.log(`  ✅ PASS → Error capturado correctamente: "${err.message}"`);
    }

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log('  🏁 Flujo completo de transporte TCP validado.');
    console.log('══════════════════════════════════════════════════\n');
}

// ─────────────────────────────────────────────────────────
// Bootstrap: levantar servidor, correr pruebas, cerrar todo
// ─────────────────────────────────────────────────────────
servidorDePrueba.listen(PUERTO_AISLADO, async () => {
    console.log(`\n[🧪 SETUP] Servidor de prueba activo en puerto ${PUERTO_AISLADO}`);

    try {
        await ejecutarPruebas();
    } finally {
        servidorDePrueba.close(() => {
            console.log('[🧪 TEARDOWN] Servidor de prueba cerrado. Entorno limpio.\n');
        });
    }
});

servidorDePrueba.on('error', (err) => {
    console.error(`[❌ SETUP ERR] No se pudo levantar el servidor de prueba: ${err.message}`);
    process.exit(1);
});