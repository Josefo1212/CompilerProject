import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuración para emular __dirname en ES Modules nativos
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SDLCompiler {

    constructor(idlFile = 'saludo.sdl') {
        this.idlPath = join(process.cwd(), idlFile);
        this.templatesDir = join(__dirname, 'templates');
        this.outputDirs = {
            client: join(process.cwd(), 'client'),
            server: join(process.cwd(), 'server')
        };
    }

    // ----------------------------------------------------------------
    // MOTOR DE PLANTILLAS (Laura): lee un .tpl y sustituye placeholders
    // ----------------------------------------------------------------
    applyTemplate(templateName, vars) {
        const tplPath = join(this.templatesDir, templateName);
        if (!existsSync(tplPath)) {
            throw new Error(`Plantilla no encontrada: ${tplPath}`);
        }
        let tpl = readFileSync(tplPath, 'utf-8');
        for (const [key, value] of Object.entries(vars)) {
            // Reemplaza todas las ocurrencias de {{KEY}}
            tpl = tpl.replaceAll(`{{${key}}}`, value);
        }
        return tpl;
    }

    compile() {
        try {
            console.log(`[🚀 COMPILER] Iniciando compilación de de: ${this.idlPath}`);

            const metadata = this.parseSDL();
            this.prepareDirectories();
            this.generateArtifacts(metadata);

            console.log('\n[✨ SUCCESS] Arquitectura distribuida generada con éxito en /client y /server.');
        } catch (error) {
            console.error(`[❌ ERROR] Fallo en la compilación: ${error.message}`);
        }
    }

    // ----------------------------------------------------------------
    // 1. PARSER CORE: Extracción y limpieza de la Metadata del SDL
    // ----------------------------------------------------------------
    parseSDL() {
        if (!existsSync(this.idlPath)) {
            throw new Error(`Archivo contractual "${this.idlPath}" no encontrado.`);
        }

        const contenido = readFileSync(this.idlPath, 'utf-8');
        const lineas = contenido.split(/\r?\n/).map(line => line.trim());

        let port = '';
        let ip = '';
        let className = '';
        const methods = [];

        for (const linea of lineas) {
            if (!linea || linea.startsWith('}')) continue;

            if (linea.startsWith('@port:')) {
                port = linea.split(':')[1]?.trim();
            } else if (linea.startsWith('@ip:')) {
                ip = linea.split(':')[1]?.trim();
            } else if (linea.startsWith('@class ')) {
                className = linea.replace('@class ', '').replace('{', '').trim();
            } else if (linea.startsWith('@method ')) {
                methods.push(this.extractMethodMetadata(linea));
            }
        }

        if (!port || !ip || !className) {
            throw new Error('Formato SDL inválido. Faltan directivas obligatorias (@port, @ip o @class).');
        }

        return { port, ip, className, methods };
    }

    extractMethodMetadata(linea) {
        const textoCompleto = linea.replace('@method ', '').trim();
        const [nombreMetodo, paramsRaw] = textoCompleto.split('(');

        const parametros = paramsRaw
            ? paramsRaw.replace(')', '').split(',').map(p => p.trim()).filter(Boolean)
            : [];

        return {
            textoCompleto,
            nombre: nombreMetodo.trim(),
            parametros
        };
    }

    // ----------------------------------------------------------------
    // 2. INFRAESTRUCTURA: Inicialización del File System
    // ----------------------------------------------------------------
    prepareDirectories() {
        Object.values(this.outputDirs).forEach(dir => {
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
        });
    }

    // ----------------------------------------------------------------
    // 3. ENGINE: Generación de código asíncrono limpio (ESM)
    // ----------------------------------------------------------------
    generateArtifacts(metadata) {
        const { className } = metadata;
        const { client: clientDir, server: serverDir } = this.outputDirs;

        // --- MOLDES LADO CLIENTE (STUBS) ---
        // Proxy: plantilla de Luismi (Proxy.template.tpl)
        const metodosProxy = metadata.methods.map(m => {
            return `    ${m.nombre}(${m.parametros.join(', ')}) {\n        throw new Error("Abstract method: ${m.nombre} must be implemented in ClientRSI");\n    }`;
        }).join('\n\n');

        const codeProxy = this.applyTemplate('Proxy.template.tpl', {
            CLASS_NAME: className,
            METODOS_PROXY: metodosProxy,
        });

        // ClientRSI: plantilla de Laura (ClientRSI.template.tpl)
        const metodosCliente = metadata.methods.map(m => {
            const paramList = m.parametros.join(', ');
            const argsArray = m.parametros.length > 0 ? paramList : '';
            return (
                `    async ${m.nombre}(${paramList}) {
        return this._enviarPeticion('${m.nombre}', ${argsArray});
    }`
            );
        }).join('\n\n');

        const codeClientRSI = this.applyTemplate('ClientRSI.template.tpl', {
            CLASS_NAME: className,
            PUERTO: metadata.port,
            IP: metadata.ip,
            METODOS_CLIENTE: metodosCliente,
        });

        // Client Main: plantilla de Luismi (Client.template.tpl)
        const llamadasPrueba = metadata.methods.map(m => {
            const defaultArgs = m.parametros.map(p => `"test_${p}"`).join(', ');
            return `        const res_${m.nombre} = await client.${m.nombre}(${defaultArgs});\n        console.log("Result for ${m.nombre}:", res_${m.nombre});`;
        }).join('\n');

        const codeClientScript = this.applyTemplate('Client.template.tpl', {
            CLASS_NAME: className,
            LLAMADAS_PRUEBA: llamadasPrueba,
        });

        // --- MOLDES LADO SERVIDOR (SKELETON) ---
        // ServerRSI: plantilla de Laura (ServerRSI.template.tpl)
        const metodosServidor = metadata.methods.map(m => {
            return (
                `                        case '${m.nombre}': {
                            const resultado = await this.bo.${m.nombre}(...args);
                            socket.write(\`SUCCESS|\${resultado}\`);
                            break;
                        }`
            );
        }).join('\n');

        const codeServerRSI = this.applyTemplate('ServerRSI.template.tpl', {
            CLASS_NAME: className,
            PUERTO: metadata.port,
            METODOS_SERVIDOR: metodosServidor,
        });

        // BO: plantilla de Luismi (BO.template.tpl)
        const metodosBO = metadata.methods.map(m => {
            return `    ${m.nombre}(${m.parametros.join(', ')}) {\n        // TODO: Hardcodee su lógica de negocio o "Hola Mundo" aquí\n        console.log("Ejecutando ${m.nombre} con:", ${m.parametros.length ? m.parametros.join(', ') : 'null'});\n        return "Hola desde el Servidor para: ${m.nombre}";\n    }`;
        }).join('\n\n');

        const codeBO = this.applyTemplate('BO.template.tpl', {
            CLASS_NAME: className,
            METODOS_BO: metodosBO,
        });

        // Server Main: plantilla ejecutable
        const codeServerMain = this.applyTemplate('Server.template.tpl', {
            CLASS_NAME: className,
        });

        // Escritura de archivos atómica (siempre UTF-8 para preservar tildes y emojis)
        const writeUTF8 = (path, content) => writeFileSync(path, content, 'utf-8');

        writeUTF8(join(clientDir, `${className}Client.js`), codeClientScript);
        writeUTF8(join(clientDir, `${className}Proxy.js`), codeProxy);
        writeUTF8(join(clientDir, `${className}ClientRSI.js`), codeClientRSI);

        writeUTF8(join(serverDir, `${className}Server.js`), codeServerMain);
        writeUTF8(join(serverDir, `${className}ServerRSI.js`), codeServerRSI);
        writeUTF8(join(serverDir, `${className}BO.js`), codeBO);
    }
}

// Inicialización del proceso
const compiler = new SDLCompiler('saludo.sdl');
compiler.compile();